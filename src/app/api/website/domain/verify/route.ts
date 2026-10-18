import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import dns from 'dns'
import { promisify } from 'util'

const dnsResolve = promisify(dns.resolve)

/**
 * POST /api/website/domain/verify
 * Xác minh quyền sở hữu domain bằng cách kiểm tra CNAME record
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()
    const { propertyId, domain } = body

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId || !domain) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId hoặc domain' }, { status: 400 })
    }

    // Validate domain format
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ success: false, error: 'Tên miền không hợp lệ' }, { status: 400 })
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

    // Get expected CNAME target (subdomain of main app)
    const expectedTarget = `${property.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'digistay.vn'}`
    const alternativeTarget = `${property.subdomain}.${process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost'}`

    let verificationStatus = 'pending'
    let verificationDetails: Record<string, any> = {
      domain,
      checkedAt: new Date().toISOString(),
    }

    try {
      // Check CNAME record
      const cnameRecords = await dnsResolve(domain, 'CNAME').catch(() => [])
      
      if (cnameRecords.length > 0) {
        const cnameTarget = cnameRecords[0].toLowerCase().replace(/\.+$/, '')
        const isValid = 
          cnameTarget === expectedTarget.toLowerCase() ||
          cnameTarget === alternativeTarget.toLowerCase() ||
          cnameTarget.endsWith(`.${(process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'digistay.vn').toLowerCase()}`) ||
          cnameTarget.endsWith(`.${(process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost').toLowerCase()}`)

        verificationStatus = isValid ? 'verified' : 'mismatch'
        verificationDetails = {
          ...verificationDetails,
          recordType: 'CNAME',
          actualValue: cnameRecords[0],
          expectedValue: expectedTarget,
          isValid,
        }
      } else {
        // Also check A record for direct IP
        const aRecords = await dnsResolve(domain, 'A').catch(() => [])
        
        if (aRecords.length > 0) {
          verificationStatus = 'a_record'
          verificationDetails = {
            ...verificationDetails,
            recordType: 'A',
            actualValue: aRecords[0],
            note: 'A record detected. CNAME recommended for better SSL provisioning.',
          }
        } else {
          verificationStatus = 'not_found'
          verificationDetails = {
            ...verificationDetails,
            recordType: 'NONE',
            expectedValue: expectedTarget,
          }
        }
      }
    } catch (dnsError: any) {
      verificationStatus = 'dns_error'
      verificationDetails = {
        ...verificationDetails,
        error: dnsError.message,
      }
    }

    // Update verification status in database
    const updatedSettings = await prisma.websiteSettings.update({
      where: { propertyId },
      data: {
        customDomain: domain,
        domainVerificationStatus: verificationStatus,
        domainVerifiedAt: verificationStatus === 'verified' ? new Date() : null,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId,
        action: 'VERIFY_DOMAIN',
        entityType: 'WEBSITE_SETTINGS',
        entityId: updatedSettings.id,
        changes: { domain, status: verificationStatus },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        status: verificationStatus,
        details: verificationDetails,
        message: getVerificationMessage(verificationStatus),
        instructions: getVerificationInstructions(domain, expectedTarget),
      },
    })
  } catch (error) {
    console.error('Domain verification error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xác minh domain' }, { status: 500 })
  }
}

function getVerificationMessage(status: string): string {
  switch (status) {
    case 'verified':
      return '✅ Tên miền đã được xác minh thành công! SSL sẽ được tự động cấp phát trong giây lát.'
    case 'mismatch':
      return '⚠️ Bản ghi CNAME không đúng. Vui lòng cập nhật theo hướng dẫn bên dưới.'
    case 'a_record':
      return '⚠️ Phát hiện bản ghi A. Khuyến nghị sử dụng CNAME để SSL hoạt động tốt nhất.'
    case 'not_found':
      return '❌ Không tìm thấy bản ghi DNS. Vui lòng thêm bản ghi CNAME theo hướng dẫn.'
    case 'dns_error':
      return '❌ Không thể kiểm tra DNS. Vui lòng thử lại sau.'
    default:
      return 'Đang xử lý xác minh...'
  }
}

function getVerificationInstructions(domain: string, target: string): string[] {
  return [
    `1. Đăng nhập vào trang quản lý domain của bạn (nơi bạn mua domain ${domain})`,
    `2. Tìm mục "Quản lý DNS" hoặc "Cấu hình DNS"`,
    `3. Thêm bản ghi CNAME mới:`,
    `   - Host/Name: @ hoặc để trống`,
    `   - Value/Target: ${target}`,
    `   - TTL: 3600 (hoặc default)`,
    `4. Chờ 5-30 phút để DNS propagation hoàn tất`,
    `5. Quay lại và nhấn "Xác minh" để kiểm tra`,
  ]
}
