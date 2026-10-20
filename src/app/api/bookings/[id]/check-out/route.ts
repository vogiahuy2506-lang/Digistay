import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params
    const body = await request.json().catch(() => ({}))

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            workspace: {
              select: {
                ownerId: true,
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

    // Check reception access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.some(m => 
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, error: 'Không có quyền check-out' }, { status: 403 })
    }

    // Check booking status
    if (booking.status !== 'CHECKED_IN') {
      return NextResponse.json({ 
        success: false, 
        error: 'Đơn đặt phòng chưa được check-in' 
      }, { status: 400 })
    }

    // Calculate late checkout fee if applicable
    const now = new Date()
    const checkoutTime = booking.checkOutDate
    const policyCheckout = new Date(now)
    const [hours, minutes] = '12:00'.split(':') // Default checkout time
    policyCheckout.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    let lateFee = 0
    let extraCharges = booking.extraCharges

    if (now > policyCheckout) {
      const hoursLate = Math.ceil((now.getTime() - policyCheckout.getTime()) / (1000 * 60 * 60))
      // Late checkout fee: typically 50% of nightly rate per hour
      const nightlyRate = booking.subtotal / 
        Math.ceil((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / (1000 * 60 * 60 * 24))
      lateFee = Math.round((nightlyRate * 0.5 / 24) * hoursLate)
      extraCharges += lateFee
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        actualCheckOut: now,
        checkedOutBy: session.user.id,
        extraCharges,
        totalAmount: booking.subtotal + extraCharges,
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
          status: 'CHECKED_OUT',
          actualCheckOut: now,
          lateFee,
        },
        metadata: { 
          bookingCode: booking.bookingCode,
          checkedOutBy: session.user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: lateFee > 0 
        ? `Check-out thành công. Phí trả phòng muộn: ${lateFee.toLocaleString('vi-VN')} VNĐ`
        : 'Check-out thành công',
      lateFee,
    })
  } catch (error) {
    console.error('Check-out error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi check-out' }, { status: 500 })
  }
}
