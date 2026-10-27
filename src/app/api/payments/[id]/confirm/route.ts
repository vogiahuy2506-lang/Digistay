import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { can, checkAccess } from '@/lib/auth/access'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'
import { queueGuestDepositReceived } from '@/lib/payments/deposit-received'
import { sendAfterResponse } from '@/lib/email/outbox'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { getClientIp } from '@/lib/security/client-ip'

interface RouteParams {
  params: Promise<{ id: string }>
}

class PaymentNotPendingError extends Error {}

/**
 * POST /api/payments/[id]/confirm
 * Staff confirm that a PENDING bank transfer has been received.
 *
 * - Only who may work payments at the property (payments_manage).
 * - PENDING → PAID via a conditional update inside a transaction: a double
 *   click, or two staff clicking at once, matches no row the second time
 *   and gets 409.
 * - ActivityLog records who confirmed, when, and from where.
 * - A guest's online deposit (a manual transfer the guest said they made,
 *   src/lib/payments/manual-deposit.ts) also tells the guest and the front
 *   desk, as the PayOS webhook does (deposit-received.ts).
 */
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess.response
    const userId = sess.session.user.id

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        bookingId: true,
        propertyId: true,
        amount: true,
        metadata: true,
        property: { select: { workspaceId: true } },
      },
    })

    // Outsiders (and members not on this property) get the same 404 as a
    // missing payment, so payment ids of other properties cannot be probed.
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy thanh toán' }, { status: 404 })
    }
    const granted = await checkAccess(userId, payment.property.workspaceId, null, {
      propertyId: payment.propertyId,
      notFound: 'Không tìm thấy thanh toán',
    })
    if (!granted.ok) return granted.response
    if (!can(granted.access, 'payments_manage', payment.propertyId)) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xác nhận thanh toán' },
        { status: 403 }
      )
    }
    const locked = await lockedResponseForProperty(payment.propertyId)
    if (locked) return locked

    const paidAt = new Date()
    // The address nginx saw (client-ip.ts), not the first X-Forwarded-For entry, which the client writes.
    const ipAddress = getClientIp(request.headers)
    const userAgent = request.headers.get('user-agent')

    const result = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, payment.bookingId)

      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt },
      })
      if (count === 0) throw new PaymentNotPendingError()

      // Closed bookings: the money is recorded, the booking is not reopened.
      const { closed: paidAfterClosed } = await syncBookingPayments(tx, payment.bookingId)
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        select: { status: true },
      })

      await tx.activityLog.create({
        data: {
          userId,
          workspaceId: payment.property.workspaceId,
          propertyId: payment.propertyId,
          action: 'CONFIRM_PAYMENT',
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: {
            bookingId: payment.bookingId,
            amount: payment.amount,
            confirmedAt: paidAt.toISOString(),
            role: granted.access.role,
            ...(paidAfterClosed && { paidAfterClosed: true, bookingStatus: booking.status }),
          },
          ipAddress,
          userAgent,
        },
      })

      const emailIds = await queueGuestDepositReceived(tx, payment, paidAfterClosed)
      return { paidAfterClosed, emailIds }
    })
    sendAfterResponse(result.emailIds)

    return NextResponse.json({
      success: true,
      data: { id: payment.id, status: 'PAID', paidAt },
      message: 'Xác nhận thanh toán thành công',
      ...(result.paidAfterClosed && {
        warning:
          'Đơn này đã huỷ hoặc khách không đến. Khoản tiền đã được ghi nhận nhưng đơn không được mở lại — cần quản lý xử lý hoàn tiền hoặc đặt lại.',
      }),
    })
  } catch (error) {
    if (error instanceof PaymentNotPendingError) {
      return NextResponse.json(
        { success: false, error: 'Khoản thanh toán này không còn ở trạng thái chờ' },
        { status: 409 }
      )
    }
    console.error('Confirm payment error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xác nhận thanh toán' }, { status: 500 })
  }
}
