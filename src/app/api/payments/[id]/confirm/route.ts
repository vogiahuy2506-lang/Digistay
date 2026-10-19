import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, getWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'

interface RouteParams {
  params: { id: string }
}

// Closed bookings: the money is still recorded, but the booking is not
// reopened and its paymentStatus (possibly REFUNDED) is not overwritten.
const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'NO_SHOW']

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
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      // Lock the booking row so two payments of the same booking are
      // confirmed one after the other; otherwise the paid total computed
      // below could miss the other one.
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${payment.bookingId} FOR UPDATE`

      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt },
      })
      if (count === 0) throw new PaymentNotPendingError()

      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        select: { status: true, totalAmount: true },
      })
      const paidAfterClosed = CLOSED_BOOKING_STATUSES.includes(booking.status)

      if (!paidAfterClosed) {
        const paid = await tx.payment.aggregate({
          where: { bookingId: payment.bookingId, status: 'PAID' },
          _sum: { amount: true },
        })
        const totalPaid = paid._sum.amount ?? 0
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            paymentStatus: totalPaid >= booking.totalAmount ? 'PAID' : 'PARTIAL',
            status: booking.status === 'PENDING' ? 'CONFIRMED' : booking.status,
            depositAmount: totalPaid,
          },
        })
      }

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
