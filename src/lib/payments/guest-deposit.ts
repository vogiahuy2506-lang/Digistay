/**
 * A guest's deposit when booking on the hotel's site, through the hotel's
 * own PayOS account (Part 5 follow-up), or by plain transfer to the hotel's
 * account, confirmed by staff (manual-deposit.ts): the hotel chooses
 * (deposit-mode.ts).
 *
 * - The hotel sets a share of the total (Chính sách, "Đặt cọc khi khách đặt
 *   trên website") and must have PayOS connected or an account to receive
 *   transfers; otherwise nothing changes: the booking waits for the hotel,
 *   paid at the desk.
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
 * - A manual deposit has no link to renew: its QR stands until the deadline,
 *   which expireUnpaidDeposits() applies the same way, without PayOS to ask.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { emailLocale } from '@/lib/email/i18n'
import { queueDepositExpired, sendAfterResponse } from '@/lib/email/outbox'
import { depositFor } from '@/lib/pricing/quote'
import { lockBooking } from './booking-payments'
import { depositUrl } from './deposit-link'
import { DEPOSIT_MODE_SELECT, effectiveDepositMode, type DepositMode, type DepositModeRows } from './deposit-mode'
import { MANUAL_DEPOSIT_WHERE, createManualDeposit } from './manual-deposit'
import { cancelPayosPayment, createPayosLink, newOrderCode, PayosError, syncPayosPayment } from './payos'

export interface OnlineDeposit {
  percent: number
  /** 0: no deadline */
  deadlineMinutes: number
  /** PAYOS: a PayOS link; MANUAL: a VietQR to the hotel's account, confirmed by staff */
  mode: DepositMode
}

/** The hotel's online deposit, or null when it takes none or has no way to take it (deposit-mode.ts). */
export async function onlineDepositOf(propertyId: string): Promise<OnlineDeposit | null> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      policy: { select: { onlineDepositPercent: true, depositDeadlineMinutes: true } },
      ...DEPOSIT_MODE_SELECT,
    },
  })
  return onlineDepositFrom(property)
}

/** Same decision from rows already loaded (the public property API, with DEPOSIT_MODE_SELECT). */
export function onlineDepositFrom(
  property:
    | (DepositModeRows & {
        policy: { onlineDepositPercent: number; depositDeadlineMinutes: number } | null
      })
    | null
): OnlineDeposit | null {
  const percent = property?.policy?.onlineDepositPercent ?? 0
  if (!(percent > 0) || !property) return null
  const mode = effectiveDepositMode(property)
  if (!mode) return null
  return { percent, deadlineMinutes: property.policy?.depositDeadlineMinutes ?? 0, mode }
}

/**
 * Records the deposit payment of a booking just made: its PayOS link, or
 * the manual transfer's QR (checkoutUrl null). Returns what the guest needs
 * to pay, or null if PayOS failed (the payment is then kept as FAILED, see
 * createPayosLink) or the hotel has no receiving account any more.
 */
export async function startGuestDeposit(
  booking: { id: string; propertyId: string; bookingCode: string; totalAmount: number },
  deposit: OnlineDeposit,
  returnUrl: string
): Promise<{ amount: number; checkoutUrl: string | null; expiresAt: Date | null } | null> {
  const amount = depositFor(booking.totalAmount, deposit.percent)
  if (amount <= 0) return null
  const deadline = deposit.deadlineMinutes > 0 ? new Date(Date.now() + deposit.deadlineMinutes * 60_000) : null
  const terms = { amount, percent: deposit.percent, deadline, deadlineMinutes: deposit.deadlineMinutes }
  if (deposit.mode === 'MANUAL') return createManualDeposit(booking, terms)
  return createDepositPayment(booking, terms, returnUrl)
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
export async function payDepositAgain(bookingId: string): Promise<{ checkoutUrl: string } | { paid: true } | { manual: true }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      propertyId: true,
      bookingCode: true,
      totalAmount: true,
      createdAt: true,
      locale: true,
      property: { select: { subdomain: true, isActive: true } },
      payments: {
        where: { OR: [{ paymentGateway: 'PAYOS', metadata: { path: ['guestDeposit'], equals: true } }, MANUAL_DEPOSIT_WHERE] },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, amount: true, checkoutUrl: true, expiresAt: true, metadata: true, paymentGateway: true },
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

  // A manual QR still waiting stands as it is: nothing to renew.
  if (latest?.status === 'PENDING' && latest.paymentGateway === null) return { manual: true }

  // A live link: ask PayOS first (it may have been paid), then reuse it.
  if (latest?.status === 'PENDING' && latest.checkoutUrl && latest.expiresAt && latest.expiresAt.getTime() > Date.now()) {
    const status = await syncPayosPayment(latest.id)
    if (status === 'PAID') return { paid: true }
    if (status === 'PENDING') return { checkoutUrl: latest.checkoutUrl }
  }

  const amount = latest?.amount ?? depositFor(booking.totalAmount, policy.percent)
  const terms = {
    amount,
    percent: (latest?.metadata as { percent?: number } | null)?.percent ?? policy.percent,
    deadline,
    deadlineMinutes: (latest?.metadata as { deadlineMinutes?: number } | null)?.deadlineMinutes ?? policy.deadlineMinutes,
    retryOf: latest?.id,
  }
  // The hotel moved to manual transfers since: the guest gets its QR instead of a new link.
  if (policy.mode === 'MANUAL') {
    if (!(await createManualDeposit(booking, terms))) throw new DepositError('Khách sạn hiện không nhận đặt cọc online; khách sạn sẽ liên hệ với bạn')
    return { manual: true }
  }
  const created = await createDepositPayment(booking, terms, depositUrl(booking.property.subdomain, booking.id, emailLocale(booking.locale)))
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
 * told the hotel would call. So is a booking with a SePay card payment still
 * PENDING (SePay is no longer a gateway, and cannot be asked). Manual
 * transfers (manual-deposit.ts) have nobody to ask: past their deadline
 * (pushed back once if the guest said they transferred), the booking is
 * cancelled the same way; money that turns up later is confirmed by staff
 * on the cancelled booking, as for PayOS.
 */
export async function expireUnpaidDeposits(now = new Date()): Promise<DepositExpirySummary> {
  const due = await prisma.payment.findMany({
    where: {
      paymentGateway: 'PAYOS',
      status: { in: ['PENDING', 'EXPIRED', 'CANCELLED'] },
      expiresAt: { lt: now },
      metadata: { path: ['autoCancel'], equals: true },
      // A card payment from when SePay was a gateway (until 2026-10-25),
      // still PENDING: nobody can ask SePay any more whether the card was
      // charged, so the hotel decides, as for a link PayOS refused.
      booking: { status: 'PENDING', payments: { none: { paymentGateway: 'SEPAY', status: 'PENDING' } } },
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
  await expireManualDeposits(now, summary)
  return summary
}

/** Manual transfers past their deadline: nothing to ask, the booking is cancelled (cancelUnpaidBooking). */
async function expireManualDeposits(now: Date, summary: DepositExpirySummary) {
  const due = await prisma.payment.findMany({
    where: {
      ...MANUAL_DEPOSIT_WHERE,
      AND: [...MANUAL_DEPOSIT_WHERE.AND, { metadata: { path: ['autoCancel'], equals: true } }],
      status: 'PENDING',
      expiresAt: { lt: now },
      booking: { status: 'PENDING' },
    },
    select: { id: true, bookingId: true, metadata: true },
    orderBy: { expiresAt: 'asc' },
    take: MAX_PER_RUN,
  })
  for (const payment of due) {
    summary.checked++
    try {
      const emailIds = await cancelUnpaidBooking(payment.bookingId, payment.metadata, { paymentId: payment.id, now })
      if (emailIds) {
        summary.cancelled++
        sendAfterResponse(emailIds)
      }
    } catch (error) {
      summary.errors++
      console.error(`[deposit] expiry of manual deposit ${payment.id} failed:`, error)
    }
  }
}

/**
 * `manual`: a manual deposit's expiry, checked again under the booking's
 * lock (a claim may have just pushed the deadline back) and marked EXPIRED
 * with the booking.
 */
async function cancelUnpaidBooking(
  bookingId: string,
  metadata: Prisma.JsonValue,
  manual?: { paymentId: string; now: Date }
): Promise<string[] | null> {
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
        locale: true,
        property: { select: { name: true, phone: true } },
        payments: { where: { status: 'PAID' }, select: { id: true } },
      },
    })
    // Confirmed by staff, or money arrived meanwhile: keep it.
    if (booking.status !== 'PENDING' || booking.payments.length > 0) return null
    if (manual) {
      const current = await tx.payment.findUniqueOrThrow({ where: { id: manual.paymentId }, select: { status: true, expiresAt: true } })
      if (current.status !== 'PENDING' || !current.expiresAt || current.expiresAt > manual.now) return null
      await tx.payment.update({ where: { id: manual.paymentId }, data: { status: 'EXPIRED' } })
    }

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
          locale: emailLocale(booking.locale),
        },
        bookingId,
        tx
      ),
    ]
  })
}
