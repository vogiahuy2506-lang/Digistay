import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'

const memberOf = (userId: string) => ({
  workspace: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
})

/**
 * POST /api/website/ssl/provision
 * Yêu cầu cấp phát SSL certificate cho domain
 * Trong production, đây sẽ tích hợp với Let's Encrypt hoặc Cloudflare
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
            { members: { some: { userId: session.user.id } } },
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

    // Check if SSL already enabled and not expired
    if (settings.sslEnabled && settings.sslVerifiedAt) {
      const expiryDate = new Date(settings.sslVerifiedAt)
      expiryDate.setMonth(expiryDate.getMonth() + 3) // Assume 3-month cert
      
      if (new Date() < expiryDate) {
        return NextResponse.json({
          success: true,
          data: {
            sslEnabled: true,
            sslVerifiedAt: settings.sslVerifiedAt,
            expiresAt: expiryDate.toISOString(),
            message: 'SSL certificate vẫn còn hiệu lực',
          },
          message: 'SSL đã được kích hoạt',
        })
      }
    }

    // Simulate SSL provisioning (in production, integrate with Let's Encrypt/Cloudflare)
    // This would typically:
    // 1. Create ACME challenge for domain verification
    // 2. Issue certificate via Let's Encrypt
    // 3. Configure nginx/caddy to use the certificate
    // 4. Set up auto-renewal cron job

    const provisioningResult = await simulateSSLProvisioning(settings.customDomain)

    // Update settings
    const updatedSettings = await prisma.websiteSettings.update({
      where: { propertyId: property.id },
      data: {
        sslEnabled: true,
        sslVerifiedAt: new Date(),
        sslProvider: provisioningResult.provider,
        sslCertificateId: provisioningResult.certificateId,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: property.id,
        action: 'SSL_PROVISION',
        entityType: 'WEBSITE_SETTINGS',
        entityId: updatedSettings.id,
        changes: { 
          domain: settings.customDomain,
          provider: provisioningResult.provider,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        sslEnabled: true,
        sslVerifiedAt: updatedSettings.sslVerifiedAt,
        domain: settings.customDomain,
        provider: provisioningResult.provider,
        message: `SSL certificate đã được cấp phát thành công cho ${settings.customDomain}`,
      },
      message: 'SSL đã được kích hoạt thành công! Website của bạn giờ đây an toàn với HTTPS.',
    })
  } catch (error) {
    console.error('SSL provisioning error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cấp phát SSL' }, { status: 500 })
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
    }
    
    if (settings.sslVerifiedAt) {
      const expiryDate = new Date(settings.sslVerifiedAt)
      expiryDate.setMonth(expiryDate.getMonth() + 3)
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
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
    if (!access.ok) return access.response

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

// Simulate SSL provisioning (replace with real implementation in production)
async function simulateSSLProvisioning(domain: string) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))

  return {
    provider: 'digistay-auto-ssl',
    certificateId: `cert_${Date.now()}_${domain.replace(/\./g, '_')}`,
    provisionedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
  }
}
