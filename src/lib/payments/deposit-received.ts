/**
 * "We received your deposit": queued when a guest's deposit from the
 * hotel's site (guest-deposit.ts) is paid, through PayOS or SePay, in the
 * transaction that marks it PAID, with the hotel's bell
 * (src/lib/notifications.ts). Not for a booking already cancelled: staff
 * sort that money out (the payment is flagged).
 */
import type { Prisma } from '@prisma/client'
import { emailLocale } from '@/lib/email/i18n'
import { queueDepositReceived } from '@/lib/email/outbox'
import { notifyDepositPaid } from '@/lib/notifications'

export async function queueGuestDepositReceived(
  tx: Prisma.TransactionClient,
  payment: { bookingId: string; amount: number; metadata: Prisma.JsonValue },
  closed: boolean
): Promise<string[]> {
  const meta = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata) ? payment.metadata : {}
  if ((meta as { guestDeposit?: unknown }).guestDeposit !== true || closed) return []
  await notifyDepositPaid(tx, payment)
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: payment.bookingId },
    select: {
      guestEmail: true,
      guestName: true,
      bookingCode: true,
      checkInDate: true,
      checkOutDate: true,
      totalAmount: true,
      depositAmount: true,
      locale: true,
      property: { select: { name: true, phone: true } },
    },
  })
  if (!booking.guestEmail) return []
  return [
    await queueDepositReceived(
      {
        guestEmail: booking.guestEmail,
        guestName: booking.guestName,
        bookingCode: booking.bookingCode,
        propertyName: booking.property.name,
        propertyPhone: booking.property.phone,
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
        deposit: payment.amount,
        remaining: Math.max(0, booking.totalAmount - booking.depositAmount),
        locale: emailLocale(booking.locale),
      },
      payment.bookingId,
      tx
    ),
  ]
}
