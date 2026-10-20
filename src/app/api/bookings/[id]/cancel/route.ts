import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const cancelSchema = z.object({
  reason: z.string().optional(),
  refundAmount: z.number().min(0).optional(), // Partial refund amount
  fullRefund: z.boolean().default(false),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/bookings/[id]/cancel
 * Cancel a booking. Handles refund logic if payment was made.
 */
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = cancelSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }
    const { reason, refundAmount, fullRefund } = validation.data

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
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
        payments: {
          where: { status: 'PAID' },
          orderBy: { paidAt: 'desc' },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access: owner, admin/manager, or the guest who made the booking
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.some(m =>
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )
    const isGuest = booking.guestEmail === session.user.email

    if (!isOwner && !isStaff && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền hủy đơn' }, { status: 403 })
    }

    // Check if booking can be cancelled
    if (['CANCELLED', 'CHECKED_OUT'].includes(booking.status)) {
      return NextResponse.json({
        success: false,
        error: 'Đơn đặt phòng không thể hủy ở trạng thái hiện tại',
      }, { status: 400 })
    }

    // If already checked in, only owner/admin can cancel
    if (booking.status === 'CHECKED_IN' && !isOwner && !isStaff) {
      return NextResponse.json({
        success: false,
        error: 'Chỉ quản lý mới có thể hủy đơn đã nhận phòng',
      }, { status: 403 })
    }

    // Calculate refund
    const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0)
    let finalRefundAmount = 0

    if (totalPaid > 0) {
      // Check cancellation policy
      const policy = await prisma.policy.findUnique({
        where: { propertyId: booking.propertyId },
      })

      const hoursUntilCheckIn = Math.floor(
        (new Date(booking.checkInDate).getTime() - Date.now()) / (1000 * 60 * 60)
      )

      // If cancellation is free (enough hours notice), full refund
      // If within free cancellation window, no refund
      const freeCancellationHours = policy?.cancellationHours ?? 24

      if (hoursUntilCheckIn >= freeCancellationHours) {
        // Free cancellation available
        finalRefundAmount = fullRefund ? totalPaid : (refundAmount ?? totalPaid)
      } else if (booking.status === 'CHECKED_IN') {
        // Already checked in - refund is at discretion
        finalRefundAmount = fullRefund ? totalPaid : (refundAmount ?? 0)
      } else {
        // Within penalty window - partial/no refund
        finalRefundAmount = refundAmount ?? 0
      }

      // Mark payments as refunded
      if (finalRefundAmount > 0) {
        for (const payment of booking.payments) {
          const paymentRefund = Math.min(payment.amount, finalRefundAmount)
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: paymentRefund >= payment.amount ? 'REFUNDED' : 'PROCESSING',
              metadata: { refundReason: reason, refundedAt: new Date().toISOString() },
            },
          })
          finalRefundAmount -= paymentRefund
          if (finalRefundAmount <= 0) break
        }
      }
    }

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        paymentStatus: (totalPaid > 0 && finalRefundAmount < totalPaid
          ? 'PARTIAL'
          : 'REFUNDED') as 'PARTIAL' | 'REFUNDED',
      },
      include: {
        bookingItems: true,
        payments: { where: { status: { in: ['PAID', 'REFUNDED', 'PROCESSING'] } } },
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
        action: 'CANCEL',
        entityType: 'BOOKING',
        entityId: id,
        changes: {
          status: 'CANCELLED',
          reason,
          refundAmount: totalPaid > 0 ? totalPaid - finalRefundAmount : 0,
        },
        metadata: {
          bookingCode: booking.bookingCode,
          cancelledBy: session.user.id,
          isGuestCancel: isGuest && !isOwner && !isStaff,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Hủy đặt phòng thành công',
      refundInfo: totalPaid > 0
        ? { totalPaid, refundAmount: totalPaid - finalRefundAmount }
        : null,
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi hủy đặt phòng' }, { status: 500 })
  }
}
