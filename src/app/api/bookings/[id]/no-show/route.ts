import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { can, checkPropertyAccess } from '@/lib/auth/access'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/bookings/[id]/no-show
 * Mark a booking as no-show (guest didn't arrive)
 */
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({ where: { id } })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access; outsiders get the 404 of a missing booking.
    const access = await checkPropertyAccess(session.user.id, booking.propertyId, null, 'Không tìm thấy đơn đặt phòng')
    if (!access.ok) return access.response
    if (!can(access.access, 'bookings_edit', booking.propertyId)) {
      return NextResponse.json({ success: false, error: 'Không có quyền đánh dấu no-show' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    // Only confirmed or pending bookings can be marked as no-show
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return NextResponse.json({
        success: false,
        error: 'Chỉ có thể đánh dấu no-show cho đơn đang chờ hoặc đã xác nhận',
      }, { status: 400 })
    }

    // Check if it's past the check-in date
    const now = new Date()
    const checkInDate = new Date(booking.checkInDate)
    const endOfCheckInDay = new Date(checkInDate)
    endOfCheckInDay.setHours(23, 59, 59, 999)

    if (now < checkInDate) {
      return NextResponse.json({
        success: false,
        error: 'Chưa đến ngày nhận phòng, không thể đánh dấu no-show',
      }, { status: 400 })
    }

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'NO_SHOW',
        paymentStatus: (booking.depositAmount > 0
          ? 'PARTIAL'
          : 'PENDING') as 'PARTIAL' | 'PENDING',
      },
      include: {
        bookingItems: true,
        payments: { where: { status: { in: ['PAID', 'REFUNDED'] } } },
        property: {
          select: { id: true, name: true },
        },
      },
    })

    // Remove room locks
    await prisma.roomLock.deleteMany({
      where: { bookingId: id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'NO_SHOW',
        entityType: 'BOOKING',
        entityId: id,
        metadata: {
          bookingCode: booking.bookingCode,
          markedBy: session.user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Đánh dấu no-show thành công',
    })
  } catch (error) {
    console.error('No-show booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi đánh dấu no-show' }, { status: 500 })
  }
}
