import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { emailLocale } from '@/lib/email/i18n'
import { appSiteUrl } from '@/lib/public-site/paths'
import { lockedResponse } from '@/lib/billing/guard'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/bookings/[id]/send-confirmation
 * Send booking confirmation email to guest
 */
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        bookingItems: true,
        property: {
          include: {
            workspace: {
              select: {
                ownerId: true,
                owner: {
                  select: { email: true, name: true },
                },
                members: {
                  where: { userId: session.user.id },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.length > 0
    const isGuest = booking.guestEmail === session.user.email

    if (!isOwner && !isStaff && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền gửi email' }, { status: 403 })
    }
    const locked = await lockedResponse(booking.property.workspaceId)
    if (locked) return locked

    // Get site URL. A guest's email: in their booking's language, linking to the site's pages in it.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const locale = emailLocale(booking.locale)
    const propertyUrl = appSiteUrl(siteUrl, booking.property.subdomain, locale)

    // Send confirmation email
    const { sendBookingConfirmation } = await import('@/lib/email')
    
    const result = await sendBookingConfirmation({
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      bookingCode: booking.bookingCode,
      propertyName: booking.property.name,
      propertyAddress: `${booking.property.address}, ${booking.property.city}`,
      propertyPhone: booking.property.phone,
      checkIn: booking.checkInDate.toISOString(),
      checkOut: booking.checkOutDate.toISOString(),
      numAdults: booking.numAdults,
      numChildren: booking.numChildren,
      totalAmount: booking.totalAmount,
      propertyUrl,
      locale,
    })

    // sent, not success: without SMTP the stub "succeeds" without sending.
    if (result.sent) {
      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          propertyId: booking.propertyId,
          action: 'SEND_EMAIL',
          entityType: 'BOOKING',
          entityId: id,
          metadata: {
            bookingCode: booking.bookingCode,
            emailType: 'confirmation',
            recipient: booking.guestEmail,
          },
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Đã gửi email xác nhận thành công',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.success ? 'Máy chủ chưa cấu hình gửi email (SMTP)' : result.error || 'Không thể gửi email',
      }, { status: 502 })
    }
  } catch (error) {
    console.error('Send confirmation email error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi gửi email xác nhận' }, { status: 500 })
  }
}
