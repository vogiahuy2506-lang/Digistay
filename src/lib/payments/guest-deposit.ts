/**
 * A guest's deposit when booking on the hotel's site, through the hotel's
 * own PayOS account (Part 5 follow-up).
 *
 * - The hotel sets a share of the total (Chính sách, "Đặt cọc khi khách đặt
 *   trên website") and must have PayOS connected; otherwise nothing changes:
 *   the booking waits for the hotel, paid at the desk.
 * - The booking is created as usual (PENDING), then a PENDING PayOS payment
 *   for the deposit and its link; the guest is sent to pay. The money goes
 *   to the hotel's account. Only the webhook or reconcile marks it PAID
 *   (payos.ts), and syncBookingPayments then confirms the booking. The
 *   guest's browser and the return page never mark anything paid.
 * - If PayOS fails, the booking stands and the hotel follows up: losing a
 *   booking over its deposit link would be worse.
 * - The amount comes from depositFor() (src/lib/pricing/quote.ts), the same
 *   function the booking page shows it with.
 */
import { prisma } from '@/lib/db'
import { depositFor } from '@/lib/pricing/quote'
import { createPayosLink, newOrderCode, PayosError } from './payos'

/** The hotel's online deposit, or null when it takes none or has no confirmed PayOS. */
export async function onlineDepositOf(propertyId: string): Promise<{ percent: number } | null> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { policy: { select: { onlineDepositPercent: true } }, payos: { select: { webhookConfirmedAt: true } } },
  })
  return onlineDepositFrom(property)
}

/** Same decision from rows already loaded (the public property API). */
export function onlineDepositFrom(
  property: { policy: { onlineDepositPercent: number } | null; payos: { webhookConfirmedAt: Date | null } | null } | null
): { percent: number } | null {
  const percent = property?.policy?.onlineDepositPercent ?? 0
  return percent > 0 && property?.payos?.webhookConfirmedAt ? { percent } : null
}

/**
 * Records the deposit payment of a booking just made and creates its PayOS
 * link. Returns what the guest needs to pay, or null if PayOS failed (the
 * payment is then kept as FAILED, see createPayosLink).
 */
export async function startGuestDeposit(
  booking: { id: string; propertyId: string; bookingCode: string; totalAmount: number },
  percent: number,
  returnUrl: string
): Promise<{ amount: number; checkoutUrl: string; expiresAt: Date | null } | null> {
  const amount = depositFor(booking.totalAmount, percent)
  if (amount <= 0) return null

  // Recorded before PayOS hears of it, so a webhook can always find it.
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        bookingId: booking.id,
        propertyId: booking.propertyId,
        amount,
        netAmount: amount,
        method: 'QR_VIETQR',
        status: 'PENDING',
        paymentGateway: 'PAYOS',
        gatewayOrderCode: String(newOrderCode()),
        metadata: { guestDeposit: true, percent },
      },
    })
    await tx.activityLog.create({
      data: {
        propertyId: booking.propertyId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: created.id,
        metadata: { bookingCode: booking.bookingCode, method: 'PAYOS', amount, by: 'guest', depositPercent: percent },
      },
    })
    return created
  })

  try {
    const linked = await createPayosLink(payment.id, returnUrl)
    if (!linked.checkoutUrl) return null
    return { amount, checkoutUrl: linked.checkoutUrl, expiresAt: linked.expiresAt }
  } catch (error) {
    console.error('[deposit] PayOS link failed:', error instanceof PayosError ? error.message : error)
    return null
  }
}
