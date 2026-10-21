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
 *   booking and frees its room, but only after PayOS itself says none of
 *   its links was paid: a missed webhook is applied instead of cancelling.
 * - Paying again (payDepositAgain, from the link in deposit-link.ts): the
 *   live link if there is one, otherwise a new one for the same amount that
 *   ends at the same deadline; never after the deadline or once the booking
 *   is no longer waiting.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { queueDepositExpired, sendAfterResponse } from '@/lib/email/outbox'
import { depositFor } from '@/lib/pricing/quote'
import { lockBooking } from './booking-payments'
import { depositUrl } from './deposit-link'
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
  const deadline = deposit.deadlineMinutes > 0 ? new Date(Date.now() + deposit.deadlineMinutes * 60_000) : null
  return createDepositPayment(booking, { amount, percent: deposit.percent, deadline, deadlineMinutes: deposit.deadlineMinutes }, returnUrl)
}

/** A PENDING deposit payment and its PayOS link; null if PayOS failed (the payment is kept as FAILED). */
async function createDepositPayment(
  booking: { id: string; propertyId: string; bookingCode: string },
  deposit: { amount: number; percent: number; deadline: Date | null; deadlineMinutes: number; retryOf?: string },
  returnUrl: string
): Promise<{ amount: number; checkoutUrl: string; expiresAt: Date | null } | null> {
  const { amount, deadline } = deposit
  const autoCancel = deadline !== null

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
          ...(autoCancel && { autoCancel: true, deadlineMinutes: deposit.deadlineMinutes, deadline: deadline.toISOString() }),
          ...(deposit.retryOf && { retryOf: deposit.retryOf }),
        },
      },
    })
    await tx.activityLog.create({
      data: {
        propertyId: booking.propertyId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: created.id,
        metadata: { bookingCode: booking.bookingCode, method: 'PAYOS', amount, by: 'guest', depositPercent: deposit.percent, ...(deposit.retryOf && { retryOf: deposit.retryOf }) },
      },
    })
    return created
  })

  try {
    // The link ends at the deadline (at least a minute from now).
    const ttlSec = deadline ? Math.max(60, Math.floor((deadline.getTime() - Date.now()) / 1000)) : undefined
    const linked = await createPayosLink(payment.id, returnUrl, ttlSec)
    if (!linked.checkoutUrl) return null
    return { amount, checkoutUrl: linked.checkoutUrl, expiresAt: linked.expiresAt }
  } catch (error) {
    console.error('[deposit] PayOS link failed:', error instanceof PayosError ? error.message : error)
    return null
  }
}

export class DepositError extends Error {
  constructor(
    message: string,
    readonly status = 409
  ) {
    super(message)
    this.name = 'DepositError'
  }
}

/** The deadline of a booking's deposit, from its latest deposit payment; null = none. */
function deadlineOf(payment: { metadata: Prisma.JsonValue; expiresAt: Date | null }): Date | null {
  const m = payment.metadata as { autoCancel?: boolean; deadline?: string } | null
  if (!m?.autoCancel) return null
  // Links made before the deadline was recorded end at it.
  return m.deadline ? new Date(m.deadline) : payment.expiresAt
}

/**
 * The guest pays their deposit again (the link from deposit-link.ts): the
 * live PayOS link if there is one, otherwise a new one for the same amount
 * that ends at the same deadline. Refused once the booking is no longer
 * waiting, after the deadline, or when the hotel no longer takes deposits.
 */
export async function payDepositAgain(bookingId: string): Promise<{ checkoutUrl: string } | { paid: true }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      propertyId: true,
      bookingCode: true,
      totalAmount: true,
      createdAt: true,
      property: { select: { subdomain: true, isActive: true } },
      payments: {
        where: { paymentGateway: 'PAYOS', metadata: { path: ['guestDeposit'], equals: true } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, amount: true, checkoutUrl: true, expiresAt: true, metadata: true },
      },
    },
  })
  if (!booking || !booking.property.isActive) throw new DepositError('Không tìm thấy đặt phòng', 404)
  if (booking.payments.some((p) => p.status === 'PAID') || booking.status === 'CONFIRMED') return { paid: true }
  if (booking.status !== 'PENDING') throw new DepositError('Đặt phòng này không còn chờ đặt cọc')

  const policy = await onlineDepositOf(booking.propertyId)
  if (!policy) throw new DepositError('Khách sạn hiện không nhận đặt cọc online; khách sạn sẽ liên hệ với bạn')

  const latest = booking.payments[0]
  const deadline = latest
    ? deadlineOf(latest)
    : policy.deadlineMinutes > 0
      ? new Date(booking.createdAt.getTime() + policy.deadlineMinutes * 60_000)
      : null
  if (deadline && deadline.getTime() <= Date.now() + 60_000) throw new DepositError('Đã quá hạn đặt cọc cho đặt phòng này')

  // A live link: ask PayOS first (it may have been paid), then reuse it.
  if (latest?.status === 'PENDING' && latest.checkoutUrl && latest.expiresAt && latest.expiresAt.getTime() > Date.now()) {
    const status = await syncPayosPayment(latest.id)
    if (status === 'PAID') return { paid: true }
    if (status === 'PENDING') return { checkoutUrl: latest.checkoutUrl }
  }

  const amount = latest?.amount ?? depositFor(booking.totalAmount, policy.percent)
  const created = await createDepositPayment(
    booking,
    {
      amount,
      percent: (latest?.metadata as { percent?: number } | null)?.percent ?? policy.percent,
      deadline,
      deadlineMinutes: (latest?.metadata as { deadlineMinutes?: number } | null)?.deadlineMinutes ?? policy.deadlineMinutes,
      retryOf: latest?.id,
    },
    depositUrl(booking.property.subdomain, booking.id)
  )
  if (!created) throw new DepositError('PayOS chưa tạo được link thanh toán, vui lòng thử lại sau ít phút', 502)
  return { checkoutUrl: created.checkoutUrl }
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
  const seen = new Set<string>()
  for (const payment of due) {
    // One booking can have several links (paid again after leaving PayOS).
    if (seen.has(payment.bookingId)) continue
    seen.add(payment.bookingId)
    summary.checked++
    try {
      // PayOS is the truth, for every link of the booking still open here
      // and the one that came due: paid means confirmed, not cancelled.
      const open = await prisma.payment.findMany({
        where: {
          bookingId: payment.bookingId,
          paymentGateway: 'PAYOS',
          OR: [{ id: payment.id }, { status: 'PENDING' }],
        },
        select: { id: true },
      })
      let paid = false
      for (const link of open) {
        let status = await syncPayosPayment(link.id)
        if (status === 'PENDING') status = await cancelPayosPayment(link.id)
        if (status === 'PAID') paid = true
      }
      if (paid) {
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
