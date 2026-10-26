/**
 * Keeps a booking's money fields in step with its PAID payments (Part 5).
 * Every path that marks a payment PAID, or changes what is owed, calls
 * syncBookingPayments() in the same transaction, after lockBooking(): cash,
 * staff confirmation, PayOS webhook and reconcile, booking extensions.
 *
 * Before this, the cash paths set paymentStatus PAID whatever the amount
 * and never updated depositAmount: a 200k cash deposit on a 2M booking
 * showed as fully paid, and the 200k was missing from revenue.
 *
 * A booking that turns fully paid here gets the hotel's automatic e-invoice
 * right after the response (src/lib/einvoice/issue-now.ts), whichever path
 * recorded the money.
 */
import type { Prisma } from '@prisma/client'
import { autoIssueAfterResponse } from '@/lib/einvoice/issue-now'

type Tx = Prisma.TransactionClient

/** Closed bookings keep their status and paymentStatus (possibly REFUNDED). */
export const CLOSED_BOOKING_STATUSES: readonly string[] = ['CANCELLED', 'NO_SHOW']

/**
 * Locks the booking row until the transaction ends, so payments of the same
 * booking are applied one after the other and the paid total is exact.
 */
export async function lockBooking(tx: Tx, bookingId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`
}

/**
 * Recomputes depositAmount (= everything paid) and paymentStatus from the
 * PAID payments; confirms a PENDING booking once anything is paid.
 */
export async function syncBookingPayments(
  tx: Tx,
  bookingId: string
): Promise<{ totalPaid: number; closed: boolean }> {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { status: true, totalAmount: true, paymentStatus: true },
  })
  const paid = await tx.payment.aggregate({ where: { bookingId, status: 'PAID' }, _sum: { amount: true } })
  const totalPaid = paid._sum.amount ?? 0
  const closed = CLOSED_BOOKING_STATUSES.includes(booking.status)
  if (closed) return { totalPaid, closed }

  const paymentStatus = totalPaid <= 0 ? 'PENDING' : totalPaid >= booking.totalAmount ? 'PAID' : 'PARTIAL'
  await tx.booking.update({
    where: { id: bookingId },
    data: {
      depositAmount: totalPaid,
      paymentStatus,
      status: booking.status === 'PENDING' && totalPaid > 0 ? 'CONFIRMED' : booking.status,
    },
  })
  // Fully paid just now: the invoice goes out after the response, not at the job's next run.
  if (paymentStatus === 'PAID' && booking.paymentStatus !== 'PAID') autoIssueAfterResponse(bookingId)
  return { totalPaid, closed }
}
