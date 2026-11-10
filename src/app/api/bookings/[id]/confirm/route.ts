import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { formatAddress } from '@/lib/vn-admin/address'
import { emailLocale } from '@/lib/email/i18n'
import { appSiteUrl } from '@/lib/public-site/paths'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { checkPropertyAccess } from '@/lib/auth/access'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/bookings/[id]/confirm
 * Confirm a pending booking (e.g. direct web booking with pay on arrival or walk-in)
 * and send confirmation email to guest if an email address exists.
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
        property: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    const access = await checkPropertyAccess(session.user.id, booking.propertyId, 'bookings_edit', 'Không tìm thấy đơn đặt phòng')
    if (!access.ok) return access.response

    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Không thể xác nhận đơn đặt phòng đã hủy' }, { status: 400 })
    }

    if (booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') {
      return NextResponse.json({ success: false, error: 'Đơn đặt phòng đang trong kỳ lưu trú hoặc đã hoàn thành' }, { status: 400 })
    }

    // Update status to CONFIRMED
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    })

    let emailSent = false
    let emailError: string | null = null

    if (booking.guestEmail) {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
        const locale = emailLocale(booking.locale)
        const propertyUrl = appSiteUrl(siteUrl, booking.property.subdomain, locale)

        const { sendBookingConfirmation } = await import('@/lib/email')
        const result = await sendBookingConfirmation({
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          bookingCode: booking.bookingCode,
          propertyName: booking.property.name,
          propertyAddress: formatAddress(booking.property),
          propertyPhone: booking.property.phone,
          checkIn: booking.checkInDate.toISOString(),
          checkOut: booking.checkOutDate.toISOString(),
          numAdults: booking.numAdults,
          numChildren: booking.numChildren,
          totalAmount: booking.totalAmount,
          propertyUrl,
          locale,
        })
        emailSent = Boolean(result.sent)
        if (!result.sent && result.error) {
          emailError = result.error
        }
      } catch (err) {
        console.error('Send confirmation email error:', err)
        emailError = 'Lỗi gửi email xác nhận'
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        changes: { status: 'CONFIRMED' },
        metadata: {
          bookingCode: booking.bookingCode,
          action: 'CONFIRM',
          emailSent,
          ...(emailError && { emailError }),
        },
      },
    })

    const message = booking.guestEmail
      ? emailSent
        ? 'Đã xác nhận đơn đặt phòng và gửi email cho khách'
        : 'Đã xác nhận đơn đặt phòng thành công'
      : 'Đã xác nhận đơn đặt phòng thành công'

    return NextResponse.json({
      success: true,
      message,
      data: updated,
    })
  } catch (error) {
    console.error('Confirm booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xác nhận đơn đặt phòng' }, { status: 500 })
  }
}
