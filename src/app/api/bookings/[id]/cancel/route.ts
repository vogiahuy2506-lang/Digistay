import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockBooking } from '@/lib/payments/booking-payments'
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
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Staff only: the refund amount comes from the request. Guests used to
    // be let in and could choose their own refund; no guest page calls this.
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.some(m =>
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, error: 'Không có quyền hủy đơn' }, { status: 403 })
    }

    const policy = await prisma.policy.findUnique({
      where: { propertyId: booking.propertyId },
    })

    // Under the booking lock, like every other path that moves money: two
    // cancels at once refund once, and the second one gets 400.
    const result = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)
      const current = await tx.booking.findUniqueOrThrow({ where: { id }, select: { status: true } })
      if (['CANCELLED', 'CHECKED_OUT'].includes(current.status)) return null

      const payments = await tx.payment.findMany({
        where: { bookingId: id, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
      })
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

      // How much to give back
      let toRefund = 0
      if (totalPaid > 0) {
        const hoursUntilCheckIn = Math.floor(
          (new Date(booking.checkInDate).getTime() - Date.now()) / (1000 * 60 * 60)
        )
        const freeCancellationHours = policy?.cancellationHours ?? 24

        if (hoursUntilCheckIn >= freeCancellationHours) {
          // Free cancellation available
          toRefund = fullRefund ? totalPaid : (refundAmount ?? totalPaid)
        } else if (current.status === 'CHECKED_IN') {
          // Already checked in - refund is at discretion
          toRefund = fullRefund ? totalPaid : (refundAmount ?? 0)
        } else {
          // Within penalty window - partial/no refund
          toRefund = refundAmount ?? 0
        }
        toRefund = Math.min(toRefund, totalPaid)
      }

      // Newest payments first. A partly refunded payment is PROCESSING, which
      // no gateway path will mark PAID again (payos.ts PAYABLE_STATUSES).
      let refunded = 0
      const refundedAt = new Date().toISOString()
      for (const payment of payments) {
        if (refunded >= toRefund) break
        const part = Math.min(payment.amount, toRefund - refunded)
        const metadata =
          payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
            ? (payment.metadata as Prisma.JsonObject)
            : {}
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: part >= payment.amount ? 'REFUNDED' : 'PROCESSING',
            // Merged: the gateway's own fields (PayOS order, flags) stay.
            metadata: { ...metadata, refundReason: reason ?? null, refundedAt, refundedAmount: part },
          },
        })
        refunded += part
      }

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          // Nothing paid: unchanged. All of it returned: REFUNDED. Money
          // kept, in part or in full: PARTIAL, as before.
          ...(totalPaid > 0 && { paymentStatus: refunded >= totalPaid ? 'REFUNDED' : 'PARTIAL' }),
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
      await tx.roomLock.deleteMany({
        where: { bookingId: id },
      })

      return { updatedBooking, totalPaid, refunded }
    })

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Đơn đặt phòng không thể hủy ở trạng thái hiện tại',
      }, { status: 400 })
    }
    const { updatedBooking, totalPaid, refunded } = result

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
          refundAmount: refunded,
        },
        metadata: {
          bookingCode: booking.bookingCode,
          cancelledBy: session.user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Hủy đặt phòng thành công',
      refundInfo: totalPaid > 0
        ? { totalPaid, refundAmount: refunded }
        : null,
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi hủy đặt phòng' }, { status: 500 })
  }
}
