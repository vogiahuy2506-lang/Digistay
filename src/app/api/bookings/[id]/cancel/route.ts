import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { suggestRefund } from '@/lib/bookings/cancel-refund'
import { lockBooking } from '@/lib/payments/booking-payments'
import { z } from 'zod'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { can, checkPropertyAccess } from '@/lib/auth/access'

/**
 * Cancel a booking and give money back. The refund is a suggestion from
 * the hotel's policy (src/lib/bookings/cancel-refund.ts): GET shows it,
 * POST takes the staff's decision. Refunding the suggestion is the default;
 * another amount or nothing needs a reason when it differs, and all of it
 * is logged (suggested, refunded, decision, reason, who).
 *
 * The app records the refund; the money itself goes back the way it came
 * (a transfer from the hotel's account, cash at the desk).
 */
const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  refund: z
    .object({
      decision: z.enum(['suggested', 'custom', 'none']),
      amount: z.number().int('Số tiền là số nguyên (đồng)').min(0).max(10_000_000_000).optional(),
      reason: z.string().trim().max(300).optional(),
    })
    .superRefine((v, ctx) => {
      if (v.decision === 'custom' && v.amount === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Nhập số tiền hoàn' })
      }
    })
    .optional(),
})

type Session = { user: { id: string } }

/** The booking if the caller may cancel it; otherwise the error response. */
async function bookingForStaff(id: string, session: Session) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    return { error: NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 }) }
  }

  // Outside the workspace or the property: 404, so booking ids cannot be probed.
  const access = await checkPropertyAccess(session.user.id, booking.propertyId, null, 'Không tìm thấy đơn đặt phòng')
  if (!access.ok) return { error: access.response }

  // Staff only: guests used to be let in and could choose their own refund.
  if (!can(access.access, 'bookings_cancel', booking.propertyId)) {
    return { error: NextResponse.json({ success: false, error: 'Không có quyền hủy đơn' }, { status: 403 }) }
  }
  return { booking }
}

const policyOf = (propertyId: string) =>
  prisma.policy.findUnique({
    where: { propertyId },
    select: { cancellationHours: true, lateCancelRefundPercent: true, cancellationPolicy: true },
  })

/** GET: what was paid and the refund the hotel's policy suggests if cancelled now. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const found = await bookingForStaff(id, session)
    if (found.error) return found.error
    const { booking } = found

    const [policy, paid] = await Promise.all([
      policyOf(booking.propertyId),
      prisma.payment.findMany({
        where: { bookingId: id, status: 'PAID' },
        select: { amount: true, method: true, paidAt: true },
        orderBy: { paidAt: 'desc' },
      }),
    ])
    const suggestion = suggestRefund({
      now: new Date(),
      checkInDate: booking.checkInDate,
      status: booking.status,
      totalPaid: paid.reduce((sum, p) => sum + p.amount, 0),
      cancellationHours: policy?.cancellationHours,
      lateCancelRefundPercent: policy?.lateCancelRefundPercent,
    })
    return NextResponse.json({
      success: true,
      data: {
        status: booking.status,
        cancellable: ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status),
        ...suggestion,
        payments: paid,
        policyText: policy?.cancellationPolicy ?? null,
      },
    })
  } catch (error) {
    console.error('Cancel preview error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tính tiền hoàn' }, { status: 500 })
  }
}

/** POST: cancel, refunding what the staff decided (the suggestion by default). */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = cancelSchema.safeParse(body ?? {})
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }
    const { reason } = validation.data
    const decision = validation.data.refund ?? { decision: 'suggested' as const }

    const found = await bookingForStaff(id, session)
    if (found.error) return found.error
    const { booking } = found
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    const policy = await policyOf(booking.propertyId)

    // Under the booking lock, like every other path that moves money: two
    // cancels at once refund once, and the second one gets 400.
    const result = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)
      const current = await tx.booking.findUniqueOrThrow({ where: { id }, select: { status: true } })
      if (['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(current.status)) {
        return { error: 'Đơn đặt phòng không thể hủy ở trạng thái hiện tại' }
      }

      const payments = await tx.payment.findMany({
        where: { bookingId: id, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
      })
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

      // Computed again here, never taken from the browser.
      const suggestion = suggestRefund({
        now: new Date(),
        checkInDate: booking.checkInDate,
        status: current.status,
        totalPaid,
        cancellationHours: policy?.cancellationHours,
        lateCancelRefundPercent: policy?.lateCancelRefundPercent,
      })
      const toRefund =
        decision.decision === 'suggested' ? suggestion.suggested : decision.decision === 'none' ? 0 : (decision.amount ?? 0)
      if (toRefund > totalPaid) {
        return { error: `Số tiền hoàn không được vượt quá số đã thanh toán (${totalPaid.toLocaleString('vi-VN')} ₫)` }
      }
      const refundReason = decision.decision === 'suggested' ? '' : (decision.reason ?? '')
      if (toRefund !== suggestion.suggested && refundReason.length < 3) {
        return { error: 'Ghi lý do khi hoàn khác số gợi ý theo chính sách' }
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
            metadata: { ...metadata, refundReason: refundReason || reason || null, refundedAt, refundedAmount: part },
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

      await tx.roomLock.deleteMany({ where: { bookingId: id } })

      // Same transaction: a cancellation is never left without its record.
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          propertyId: booking.propertyId,
          action: 'CANCEL',
          entityType: 'BOOKING',
          entityId: id,
          changes: {
            status: 'CANCELLED',
            reason: reason ?? null,
            totalPaid,
            refundAmount: refunded,
            suggestedRefund: suggestion.suggested,
            refundRule: suggestion.rule,
            refundPercent: suggestion.percent,
            refundDecision: decision.decision,
            ...(refundReason && { refundReason }),
          },
          metadata: {
            bookingCode: booking.bookingCode,
            cancelledBy: session.user.id,
          },
        },
      })

      return { updatedBooking, totalPaid, refunded }
    })

    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    const { updatedBooking, totalPaid, refunded } = result

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Hủy đặt phòng thành công',
      refundInfo: totalPaid > 0 ? { totalPaid, refundAmount: refunded } : null,
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi hủy đặt phòng' }, { status: 500 })
  }
}
