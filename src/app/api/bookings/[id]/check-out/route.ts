import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lateCheckoutFee } from '@/lib/bookings/late-checkout'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'

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

    // Outside the workspace: 404, so booking ids cannot be probed.
    const workspace = booking?.property.workspace
    const isOwner = workspace?.ownerId === session.user.id
    if (!booking || !workspace || (!isOwner && workspace.members.length === 0)) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check reception access
    const isStaff = workspace.members.some(m =>
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, error: 'Không có quyền check-out' }, { status: 403 })
    }

    const policy = await prisma.policy.findUnique({
      where: { propertyId: booking.propertyId },
      select: { checkOutTime: true },
    })

    // Changes what is owed: under the booking's row lock, status re-read,
    // payment status recomputed (CLAUDE.md, "Thanh toán"). Two clicks used
    // to both pass the status check.
    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)
      const current = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: { status: true, subtotal: true, extraCharges: true, totalAmount: true, checkInDate: true, checkOutDate: true },
      })
      if (current.status !== 'CHECKED_IN') return null

      const { fee: lateFee, hoursLate } = lateCheckoutFee({
        now,
        checkInDate: current.checkInDate,
        checkOutDate: current.checkOutDate,
        checkOutTime: policy?.checkOutTime,
        subtotal: current.subtotal,
      })

      await tx.booking.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT',
          actualCheckOut: now,
          checkedOutBy: session.user.id,
          // Added to the total as it stands: rebuilding it from subtotal +
          // extraCharges dropped the booking's discount.
          extraCharges: current.extraCharges + lateFee,
          totalAmount: current.totalAmount + lateFee,
        },
      })
      // A booking paid in full owes the late fee: PAID becomes PARTIAL.
      await syncBookingPayments(tx, id)

      await tx.activityLog.create({
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
            hoursLate,
          },
          metadata: {
            bookingCode: booking.bookingCode,
            checkedOutBy: session.user.id,
          },
        },
      })

      const updatedBooking = await tx.booking.findUniqueOrThrow({
        where: { id },
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
      return { updatedBooking, lateFee }
    })

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Đơn đặt phòng chưa được check-in'
      }, { status: 400 })
    }
    const { updatedBooking, lateFee } = result

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
