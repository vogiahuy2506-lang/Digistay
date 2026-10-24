/**
 * PayOS with one account per property (Part 5). Each hotel connects its own
 * PayOS account; guests pay straight into the hotel's bank account and
 * PayOS confirms by webhook. We never hold the money.
 *
 * - Keys are encrypted with secret-box, bound to the property.
 * - Connecting registers our webhook URL with PayOS (confirm-webhook),
 *   which also proves the keys work: PayOS calls the URL with a signed test
 *   payload before answering. Payments need a confirmed connection.
 * - Each property has its own webhook URL (/api/webhooks/payos/<propertyId>),
 *   so the signature is checked with that property's checksum key, and a
 *   payment is only ever looked up within that property.
 * - A payment becomes PAID through one conditional update, whichever comes
 *   first: webhook, reconcile (syncPayosPayment) or staff confirmation.
 *   Duplicates do nothing. The amount must match exactly. Money for a link
 *   that was cancelled, expired or failed is still recorded (it reached the
 *   hotel's account) and flagged for staff; a REFUNDED payment is never
 *   brought back.
 * - The return URL never marks anything paid.
 *
 * Lessons from Founder AI's PayOS integration (one platform account there):
 * see CLAUDE.md, "Quy ước code", PayOS.
 */
import { randomInt } from 'crypto'
import { PayOS, type Webhook } from '@payos/node'
import type { Prisma, PropertyPayos } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, secretContext } from '@/lib/security/secret-box'
import { emailLocale } from '@/lib/email/i18n'
import { queueDepositReceived, sendAfterResponse } from '@/lib/email/outbox'
import { lockBooking, syncBookingPayments } from './booking-payments'

/** How long a guest can pay a link: staff often send it by Zalo. */
export const PAYOS_LINK_TTL_SEC = 24 * 60 * 60
/** PayOS limit; longer descriptions are rejected. */
const DESCRIPTION_MAX = 25
const ORDER_CODE_MIN = 10 ** 15
// randomInt needs max - min < 2^48; the result stays below 2^53 (PayOS's limit).
const ORDER_CODE_SPAN = 2 ** 48 - 1

/** Payments in these statuses become PAID when PayOS reports the money. */
// Not PROCESSING: only a partial refund at booking cancel sets it, and a late
// or repeated notification must not turn refunded money back into PAID.
const PAYABLE_STATUSES = ['PENDING', 'CANCELLED', 'EXPIRED', 'FAILED'] as const

export class PayosError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
    this.name = 'PayosError'
  }
}

const keyCtx = (propertyId: string, field: 'apiKey' | 'checksumKey') =>
  secretContext('property_payos', propertyId, field)

/** A random 16-digit order code; the unique index catches the rare clash. */
export function newOrderCode(): number {
  return randomInt(ORDER_CODE_MIN, ORDER_CODE_MIN + ORDER_CODE_SPAN)
}

/** What the guest's bank shows: ASCII letters and digits, at most 25. */
export function payosDescription(bookingCode: string): string {
  return bookingCode.replace(/[^A-Za-z0-9 ]/g, '').slice(0, DESCRIPTION_MAX)
}

export function webhookUrlFor(propertyId: string): string {
  return `${process.env.NEXTAUTH_URL}/api/webhooks/payos/${propertyId}`
}

export function payosClient(row: Pick<PropertyPayos, 'propertyId' | 'clientId' | 'apiKey' | 'checksumKey'>): PayOS {
  return new PayOS({
    clientId: row.clientId,
    apiKey: decryptSecret(row.apiKey, keyCtx(row.propertyId, 'apiKey')),
    checksumKey: decryptSecret(row.checksumKey, keyCtx(row.propertyId, 'checksumKey')),
    timeout: 15_000,
    maxRetries: 1,
    logLevel: 'off',
  })
}

/** PayOS's own message (Vietnamese), or a generic one. */
function payosMessage(error: unknown): string {
  const desc = (error as { desc?: unknown })?.desc
  if (typeof desc === 'string' && desc) return desc
  return error instanceof Error && error.message ? error.message : 'Không kết nối được PayOS'
}

export async function getPayosStatus(propertyId: string) {
  const row = await prisma.propertyPayos.findUnique({
    where: { propertyId },
    select: { clientId: true, webhookConfirmedAt: true, accountName: true, accountNumber: true, updatedAt: true },
  })
  return {
    connected: Boolean(row?.webhookConfirmedAt),
    clientIdHint: row ? `••••${row.clientId.slice(-4)}` : null,
    accountName: row?.accountName ?? null,
    accountNumber: row?.accountNumber ?? null,
    connectedAt: row?.webhookConfirmedAt ?? null,
    webhookUrl: webhookUrlFor(propertyId),
  }
}

/**
 * Saves the keys, then registers the webhook URL with PayOS. PayOS calls
 * the webhook before answering, so the keys must be saved first; if PayOS
 * refuses, the previous keys (or none) are put back.
 */
export async function connectPayos(
  propertyId: string,
  input: { clientId: string; apiKey: string; checksumKey: string },
  userId: string
) {
  const previous = await prisma.propertyPayos.findUnique({ where: { propertyId } })
  const data = {
    clientId: input.clientId.trim(),
    apiKey: encryptSecret(input.apiKey.trim(), keyCtx(propertyId, 'apiKey')),
    checksumKey: encryptSecret(input.checksumKey.trim(), keyCtx(propertyId, 'checksumKey')),
    webhookConfirmedAt: null,
    accountName: null,
    accountNumber: null,
    connectedById: userId,
  }
  const row = await prisma.propertyPayos.upsert({
    where: { propertyId },
    create: { propertyId, ...data },
    update: data,
  })

  try {
    const confirmed = await payosClient(row).webhooks.confirm(webhookUrlFor(propertyId))
    await prisma.propertyPayos.update({
      where: { propertyId },
      data: {
        webhookConfirmedAt: new Date(),
        accountName: confirmed.accountName ?? null,
        accountNumber: confirmed.accountNumber ?? null,
      },
    })
  } catch (error) {
    if (previous) {
      const { createdAt: _c, updatedAt: _u, propertyId: _p, ...restore } = previous
      await prisma.propertyPayos.update({ where: { propertyId }, data: restore })
    } else {
      await prisma.propertyPayos.deleteMany({ where: { propertyId } })
    }
    throw new PayosError(`PayOS từ chối kết nối: ${payosMessage(error)}`)
  }
  return getPayosStatus(propertyId)
}

export async function disconnectPayos(propertyId: string): Promise<void> {
  await prisma.propertyPayos.deleteMany({ where: { propertyId } })
}

async function connectedRow(propertyId: string) {
  const row = await prisma.propertyPayos.findUnique({ where: { propertyId } })
  if (!row?.webhookConfirmedAt) {
    throw new PayosError('Khách sạn chưa kết nối PayOS (Tài khoản ngân hàng → Thanh toán online)')
  }
  return row
}

/**
 * Creates the PayOS link for a PENDING payment the caller just recorded
 * (with gatewayOrderCode set). If PayOS refuses, the payment is marked
 * FAILED and the error is thrown; it is still kept, since PayOS may have
 * created the link anyway (timeout) and the webhook must find it.
 * `ttlSec`: a guest deposit's link ends at the hotel's deadline.
 */
export async function createPayosLink(paymentId: string, returnBase: string, ttlSec = PAYOS_LINK_TTL_SEC) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      propertyId: true,
      gatewayOrderCode: true,
      metadata: true,
      booking: { select: { bookingCode: true, guestName: true, guestEmail: true, guestPhone: true } },
    },
  })
  const row = await connectedRow(payment.propertyId)
  const expiredAt = Math.floor(Date.now() / 1000) + ttlSec
  try {
    const link = await payosClient(row).paymentRequests.create({
      orderCode: Number(payment.gatewayOrderCode),
      amount: payment.amount,
      description: payosDescription(payment.booking.bookingCode),
      returnUrl: returnBase,
      cancelUrl: returnBase,
      expiredAt,
      buyerName: payment.booking.guestName || undefined,
      buyerEmail: payment.booking.guestEmail || undefined,
      buyerPhone: payment.booking.guestPhone || undefined,
    })
    return prisma.payment.update({
      where: { id: payment.id },
      data: {
        checkoutUrl: link.checkoutUrl,
        qrCodeUrl: link.qrCode,
        expiresAt: new Date(expiredAt * 1000),
        metadata: { ...asObject(payment.metadata), payos: { paymentLinkId: link.paymentLinkId } },
      },
    })
  } catch (error) {
    const message = payosMessage(error)
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'FAILED', metadata: { ...asObject(payment.metadata), payos: { createError: message } } },
    })
    throw new PayosError(`PayOS không tạo được link thanh toán: ${message}`, 502)
  }
}

function asObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Prisma.JsonObject) : {}
}

export type PaidOutcome = 'paid' | 'duplicate' | 'unknown' | 'amount_mismatch' | 'not_payable'

/**
 * Records money PayOS reports for one of this property's payments. Safe to
 * call any number of times, from the webhook and from reconcile at once.
 */
export async function applyPayosPaid(input: {
  propertyId: string
  orderCode: number | string
  amount: number
  reference?: string | null
  paidAt?: string | null
  source: 'webhook' | 'reconcile'
}): Promise<PaidOutcome> {
  const payment = await prisma.payment.findFirst({
    where: { propertyId: input.propertyId, gatewayOrderCode: String(input.orderCode) },
    select: { id: true, bookingId: true, amount: true, status: true, metadata: true },
  })
  if (!payment) return 'unknown'
  if (payment.status === 'PAID') return 'duplicate'
  if (!(PAYABLE_STATUSES as readonly string[]).includes(payment.status)) return 'not_payable'

  if (Math.round(input.amount) !== Math.round(payment.amount)) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...asObject(payment.metadata),
            payos: { ...asObject(asObject(payment.metadata).payos as Prisma.JsonValue), amountMismatch: input.amount },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          propertyId: input.propertyId,
          action: 'PAYOS_AMOUNT_MISMATCH',
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: { expected: payment.amount, received: input.amount, reference: input.reference ?? null },
        },
      }),
    ])
    return 'amount_mismatch'
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, payment.bookingId)
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: [...PAYABLE_STATUSES] } },
      data: { status: 'PAID', paidAt: new Date(), transactionId: input.reference ?? null },
    })
    if (claimed.count === 0) return { outcome: 'duplicate' as const, emailIds: [] }

    const lateLink = payment.status !== 'PENDING'
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...asObject(payment.metadata),
          payos: {
            ...asObject(asObject(payment.metadata).payos as Prisma.JsonValue),
            reference: input.reference ?? null,
            transactionDateTime: input.paidAt ?? null,
            confirmedBy: input.source,
            ...(lateLink && { paidAfter: payment.status }),
          },
        },
      },
    })
    const { closed } = await syncBookingPayments(tx, payment.bookingId)
    await tx.activityLog.create({
      data: {
        propertyId: input.propertyId,
        action: 'PAYOS_PAID',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: {
          bookingId: payment.bookingId,
          amount: payment.amount,
          reference: input.reference ?? null,
          source: input.source,
          ...(lateLink && { paidAfter: payment.status }),
          ...(closed && { paidAfterClosed: true }),
        },
      },
    })

    // A guest's deposit from the hotel's site (guest-deposit.ts): tell them
    // the booking is confirmed. Not for a booking already cancelled: staff
    // sort that money out (it is flagged above).
    const emailIds: string[] = []
    if (asObject(payment.metadata).guestDeposit === true && !closed) {
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
      if (booking.guestEmail) {
        emailIds.push(
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
          )
        )
      }
    }
    return { outcome: 'paid' as const, emailIds }
  })
  sendAfterResponse(result.emailIds)
  return result.outcome
}

/**
 * The webhook of one property. Answers 2xx for everything PayOS should not
 * resend (including its confirm-webhook test, whose order code is unknown),
 * and 400 for a bad signature.
 */
export async function handlePayosWebhook(propertyId: string, body: unknown): Promise<{ status: number; outcome: string }> {
  const row = await prisma.propertyPayos.findUnique({ where: { propertyId } })
  if (!row) return { status: 404, outcome: 'not_connected' }

  let data
  try {
    data = await payosClient(row).webhooks.verify(body as Webhook)
  } catch {
    return { status: 400, outcome: 'invalid_signature' }
  }
  if (data.code !== '00') return { status: 200, outcome: 'ignored' }

  const outcome = await applyPayosPaid({
    propertyId,
    orderCode: data.orderCode,
    amount: data.amount,
    reference: data.reference,
    paidAt: data.transactionDateTime,
    source: 'webhook',
  })
  return { status: 200, outcome }
}

/**
 * Asks PayOS for the link's status and applies it: for the "check now"
 * button, the pages listing pending payments, and a missed webhook.
 */
export async function syncPayosPayment(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { id: true, propertyId: true, status: true, gatewayOrderCode: true },
  })
  if (!payment.gatewayOrderCode) throw new PayosError('Khoản này không thanh toán qua PayOS')
  if (payment.status === 'PAID') return 'PAID'

  const row = await connectedRow(payment.propertyId)
  let link
  try {
    link = await payosClient(row).paymentRequests.get(Number(payment.gatewayOrderCode))
  } catch (error) {
    throw new PayosError(`Không hỏi được PayOS: ${payosMessage(error)}`, 502)
  }

  if (link.status === 'PAID') {
    await applyPayosPaid({
      propertyId: payment.propertyId,
      orderCode: payment.gatewayOrderCode,
      amount: link.amountPaid,
      reference: link.transactions[0]?.reference ?? null,
      paidAt: link.transactions[0]?.transactionDateTime ?? null,
      source: 'reconcile',
    })
  } else if (link.status === 'CANCELLED' || link.status === 'EXPIRED') {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: link.status },
    })
  }
  const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } })
  return after.status
}

/** Staff cancel a link that was not paid. */
export async function cancelPayosPayment(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { id: true, propertyId: true, status: true, gatewayOrderCode: true },
  })
  if (!payment.gatewayOrderCode || payment.status !== 'PENDING') {
    throw new PayosError('Chỉ huỷ được link PayOS đang chờ thanh toán', 409)
  }
  const row = await connectedRow(payment.propertyId)
  try {
    await payosClient(row).paymentRequests.cancel(Number(payment.gatewayOrderCode), 'Khách sạn huỷ')
  } catch (error) {
    // Most likely paid meanwhile: apply whatever PayOS says instead.
    const status = await syncPayosPayment(payment.id)
    if (status !== 'PENDING') return status
    throw new PayosError(`PayOS không huỷ được link: ${payosMessage(error)}`, 502)
  }
  await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'CANCELLED' } })
  return 'CANCELLED'
}
