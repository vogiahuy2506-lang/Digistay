import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, getWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'

interface RouteParams {
  params: Promise<{ id: string }>
}

class PaymentNotPendingError extends Error {}

/**
 * POST /api/payments/[id]/confirm
 * Staff confirm that a PENDING bank transfer has been received.
 *
 * - Only owner/ADMIN/MANAGER/RECEPTIONIST of the property's workspace.
 * - PENDING → PAID via a conditional update inside a transaction: a double
 *   click, or two staff clicking at once, matches no row the second time
 *   and gets 409.
 * - ActivityLog records who confirmed, when, and from where.
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
        property: { select: { workspaceId: true } },
      },
    })

    // Outsiders get the same 404 as a missing payment, so payment ids of
    // other properties cannot be probed.
    const role = payment ? await getWorkspaceRole(payment.property.workspaceId, userId) : null
    if (!payment || !role) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy thanh toán' }, { status: 404 })
    }
    if (!(WorkspaceRoles.STAFF_AND_UP as readonly string[]).includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xác nhận thanh toán' },
        { status: 403 }
      )
    }

    const paidAt = new Date()
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null
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
            role,
            ...(paidAfterClosed && { paidAfterClosed: true, bookingStatus: booking.status }),
          },
          ipAddress,
          userAgent,
        },
      })

      return { paidAfterClosed }
    })

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
