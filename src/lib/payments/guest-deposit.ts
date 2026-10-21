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
 * - Deadline (Policy.depositDeadlineMinutes, 0 = none): the link ends then,
 *   and expireUnpaidDeposits() (in the 10-minute PayOS job) cancels the
 *   booking and frees its room, but only after PayOS itself says the link
 *   was not paid: a missed webhook is applied instead of cancelling.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { queueDepositExpired, sendAfterResponse } from '@/lib/email/outbox'
import { depositFor } from '@/lib/pricing/quote'
import { lockBooking } from './booking-payments'
import { cancelPayosPayment, createPayosLink, newOrderCode, PayosError, syncPayosPayment } from './payos'

export interface OnlineDeposit {
  percent: number
  /** 0: no deadline */
  deadlineMinutes: number
}

/** The hotel's online deposit, or null when it takes none or has no confirmed PayOS. */
export async function onlineDepositOf(propertyId: string): Promise<OnlineDeposit | null> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      policy: { select: { onlineDepositPercent: true, depositDeadlineMinutes: true } },
      payos: { select: { webhookConfirmedAt: true } },
    },
  })
  return onlineDepositFrom(property)
}

/** Same decision from rows already loaded (the public property API). */
export function onlineDepositFrom(
  property: {
    policy: { onlineDepositPercent: number; depositDeadlineMinutes: number } | null
    payos: { webhookConfirmedAt: Date | null } | null
  } | null
): OnlineDeposit | null {
  const percent = property?.policy?.onlineDepositPercent ?? 0
  if (!(percent > 0) || !property?.payos?.webhookConfirmedAt) return null
  return { percent, deadlineMinutes: property.policy?.depositDeadlineMinutes ?? 0 }
}

/**
 * Records the deposit payment of a booking just made and creates its PayOS
 * link. Returns what the guest needs to pay, or null if PayOS failed (the
 * payment is then kept as FAILED, see createPayosLink).
 */
export async function startGuestDeposit(
  booking: { id: string; propertyId: string; bookingCode: string; totalAmount: number },
  deposit: OnlineDeposit,
  returnUrl: string
): Promise<{ amount: number; checkoutUrl: string; expiresAt: Date | null } | null> {
  const amount = depositFor(booking.totalAmount, deposit.percent)
  if (amount <= 0) return null
  const autoCancel = deposit.deadlineMinutes > 0

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
        metadata: {
          guestDeposit: true,
          percent: deposit.percent,
          ...(autoCancel && { autoCancel: true, deadlineMinutes: deposit.deadlineMinutes }),
        },
      },
    })
    await tx.activityLog.create({
      data: {
        propertyId: booking.propertyId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: created.id,
        metadata: { bookingCode: booking.bookingCode, method: 'PAYOS', amount, by: 'guest', depositPercent: deposit.percent },
      },
    })
    return created
  })

  try {
    const linked = await createPayosLink(payment.id, returnUrl, autoCancel ? deposit.deadlineMinutes * 60 : undefined)
    if (!linked.checkoutUrl) return null
    return { amount, checkoutUrl: linked.checkoutUrl, expiresAt: linked.expiresAt }
  } catch (error) {
    console.error('[deposit] PayOS link failed:', error instanceof PayosError ? error.message : error)
    return null
  }
}

export interface DepositExpirySummary {
  checked: number
  cancelled: number
  /** paid after all (a missed webhook): confirmed instead */
  paid: number
  errors: number
}

const MAX_PER_RUN = 100

/**
 * Cancels guest bookings whose deposit deadline passed unpaid. For each:
 * ask PayOS first (a missed webhook confirms the booking instead), cancel
 * the link so it cannot be paid any more, then cancel the booking under its
 * row lock if it is still PENDING with nothing paid, free its room, and
 * tell the guest. A link whose creation failed is left alone: the guest was
 * told the hotel would call.
 */
export async function expireUnpaidDeposits(now = new Date()): Promise<DepositExpirySummary> {
  const due = await prisma.payment.findMany({
    where: {
      paymentGateway: 'PAYOS',
      status: { in: ['PENDING', 'EXPIRED', 'CANCELLED'] },
      expiresAt: { lt: now },
      metadata: { path: ['autoCancel'], equals: true },
      booking: { status: 'PENDING' },
    },
    select: { id: true, bookingId: true, metadata: true },
    orderBy: { expiresAt: 'asc' },
    take: MAX_PER_RUN,
  })

  const summary: DepositExpirySummary = { checked: 0, cancelled: 0, paid: 0, errors: 0 }
  for (const payment of due) {
    summary.checked++
    try {
      // PayOS is the truth: paid means confirmed, not cancelled.
      let status = await syncPayosPayment(payment.id)
      if (status === 'PENDING') status = await cancelPayosPayment(payment.id)
      if (status === 'PAID') {
        summary.paid++
        continue
      }
      const emailIds = await cancelUnpaidBooking(payment.bookingId, payment.metadata)
      if (emailIds) {
        summary.cancelled++
        sendAfterResponse(emailIds)
      }
    } catch (error) {
      // PayOS unreachable or disconnected: try again next run; never cancel blind.
      summary.errors++
      if (!(error instanceof PayosError)) console.error(`[deposit] expiry of ${payment.id} failed:`, error)
    }
  }
  return summary
}

async function cancelUnpaidBooking(bookingId: string, metadata: Prisma.JsonValue): Promise<string[] | null> {
  const minutes = Number((metadata as { deadlineMinutes?: number } | null)?.deadlineMinutes) || null
  return prisma.$transaction(async (tx) => {
    await lockBooking(tx, bookingId)
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        status: true,
        propertyId: true,
        bookingCode: true,
        guestName: true,
        guestEmail: true,
        property: { select: { name: true, phone: true } },
        payments: { where: { status: 'PAID' }, select: { id: true } },
      },
    })
    // Confirmed by staff, or money arrived meanwhile: keep it.
    if (booking.status !== 'PENDING' || booking.payments.length > 0) return null

    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
    await tx.roomLock.deleteMany({ where: { bookingId } })
    await tx.activityLog.create({
      data: {
        propertyId: booking.propertyId,
        action: 'CANCEL',
        entityType: 'BOOKING',
        entityId: bookingId,
        changes: { status: 'CANCELLED', reason: 'deposit_not_paid' },
        metadata: { bookingCode: booking.bookingCode, by: 'system', deadlineMinutes: minutes },
      },
    })
    if (!booking.guestEmail) return []
    return [
      await queueDepositExpired(
        {
          guestEmail: booking.guestEmail,
          guestName: booking.guestName,
          bookingCode: booking.bookingCode,
          propertyName: booking.property.name,
          propertyPhone: booking.property.phone,
        },
        bookingId,
        tx
      ),
    ]
  })
}
