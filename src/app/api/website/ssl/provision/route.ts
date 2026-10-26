import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { certificateRequest } from '@/lib/public-site/custom-domains'
import { sslState } from '@/lib/public-site/ssl-state'
import { lockedResponseForProperty } from '@/lib/billing/guard'

const memberOf = (userId: string) => ({
  workspace: { OR: [{ ownerId: userId }, { members: { some: { userId, planLockedAt: null } } }] },
})

/**
 * POST /api/website/ssl/provision — ask (again) for the HTTPS certificate of
 * the site's verified domain. The certificate itself comes from Let's Encrypt
 * through docker/certbot/custom-domains.sh on the VPS, within a minute
 * (src/lib/public-site/custom-domains.ts); this only puts the domain in its
 * queue, e.g. after a failed attempt ("Thử lại"). It used to mark the site as
 * having HTTPS without issuing anything.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json().catch(() => null)
    // A string only: a filter object would match another property in Prisma
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : null

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    // Check property access
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, planLockedAt: null } } },
          ],
        },
      },
      include: {
        websiteSettings: true,
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
    if (!access.ok) return access.response
    const locked = await lockedResponseForProperty(property.id)
    if (locked) return locked

    const settings = property.websiteSettings

    if (!settings?.customDomain) {
      return NextResponse.json({ 
        success: false, 
        error: 'Vui lòng cấu hình tên miền trước khi cấp SSL' 
      }, { status: 400 })
    }

    // Check domain verification status
    if (settings.domainVerificationStatus !== 'verified') {
      return NextResponse.json({ 
        success: false, 
        error: `Domain chưa được xác minh. Trạng thái hiện tại: ${settings.domainVerificationStatus || 'chưa xác minh'}. Vui lòng xác minh domain trước.` 
      }, { status: 400 })
    }

    if (settings.sslEnabled) {
      return NextResponse.json({ success: true, data: { state: sslState(settings) } })
    }

    const updated = await prisma.websiteSettings.update({
      where: { propertyId: property.id },
      data: certificateRequest(),
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: property.id,
        action: 'SSL_REQUEST',
        entityType: 'WEBSITE_SETTINGS',
        entityId: updated.id,
        changes: { domain: settings.customDomain },
      },
    })

    return NextResponse.json({ success: true, data: { state: sslState(updated) } })
  } catch (error) {
    console.error('SSL request error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi yêu cầu chứng chỉ SSL' }, { status: 500 })
  }
}

/**
 * GET /api/website/ssl/status?propertyId=xxx
 * Kiểm tra trạng thái SSL
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    // Only for a property the caller belongs to (any id used to answer)
    const settings = await prisma.websiteSettings.findFirst({
      where: { propertyId, property: memberOf(session.user.id) },
    })

    if (!settings) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cài đặt' }, { status: 404 })
    }

    // Calculate days until renewal
    const status: Record<string, any> = {
      sslEnabled: settings.sslEnabled,
      sslVerifiedAt: settings.sslVerifiedAt,
      customDomain: settings.customDomain,
      domainVerificationStatus: settings.domainVerificationStatus,
      sslProvider: settings.sslProvider,
      state: sslState(settings),
      sslRequestedAt: settings.sslRequestedAt,
      sslCheckedAt: settings.sslCheckedAt,
      sslError: settings.sslError,
    }
    
    if (settings.sslVerifiedAt) {
      const expiryDate = new Date(settings.sslVerifiedAt)
      expiryDate.setMonth(expiryDate.getMonth() + 3) // Let's Encrypt: 90 days, renewed daily by docker/certbot/renew.sh
      status['daysUntilExpiry'] = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      status['expiresAt'] = expiryDate.toISOString()
    }

    return NextResponse.json({
      success: true,
      data: status,
    })
  } catch (error) {
    console.error('SSL status error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi kiểm tra SSL' }, { status: 500 })
  }
}

/**
 * DELETE /api/website/ssl?propertyId=xxx
 * Hủy SSL certificate
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    // Check property access
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, planLockedAt: null } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
    if (!access.ok) return access.response
    const locked = await lockedResponseForProperty(property.id)
    if (locked) return locked

    await prisma.websiteSettings.update({
      where: { propertyId: property.id },
      data: {
        sslEnabled: false,
        sslVerifiedAt: null,
        sslProvider: null,
        sslCertificateId: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'SSL đã được gỡ bỏ',
    })
  } catch (error) {
    console.error('SSL delete error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi gỡ SSL' }, { status: 500 })
  }
}
