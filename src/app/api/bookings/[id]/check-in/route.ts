import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { can, checkPropertyAccess } from '@/lib/auth/access'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
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

    // Check reception access; outsiders get the 404 of a missing booking.
    const access = await checkPropertyAccess(session.user.id, booking.propertyId, null, 'Không tìm thấy đơn đặt phòng')
    if (!access.ok) return access.response
    if (!can(access.access, 'bookings_edit', booking.propertyId)) {
      return NextResponse.json({ success: false, error: 'Không có quyền check-in' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    // Check booking status
    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      return NextResponse.json({ 
        success: false, 
        error: 'Đơn đặt phòng không ở trạng thái có thể check-in' 
      }, { status: 400 })
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_IN',
        actualCheckIn: new Date(),
        checkedInBy: session.user.id,
      },
      include: {
        bookingItems: true,
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        changes: { 
          status: 'CHECKED_IN',
          actualCheckIn: new Date(),
        },
        metadata: { 
          bookingCode: booking.bookingCode,
          checkedInBy: session.user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Check-in thành công',
    })
  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi check-in' }, { status: 500 })
  }
}
