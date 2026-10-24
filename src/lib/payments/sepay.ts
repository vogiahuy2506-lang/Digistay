/**
 * Card payments (Visa / Mastercard / JCB) through each hotel's own SePay
 * payment gateway account (task 34). Like PayOS (payos.ts), the money goes
 * to the hotel, never through us.
 *
 * - Keys (merchant ID + secret key) are checked against SePay's API before
 *   they are saved, and the secret is encrypted with secret-box, bound to
 *   the property. Card payments need a verified connection.
 * - Paying: the guest's browser posts a signed form to SePay's checkout
 *   (sepayCheckout). The signature is HMAC-SHA256 of "field=value" pairs
 *   joined by commas, in the order the form sends them, as SePay's own SDKs
 *   do; the order here is their PHP SDK's.
 * - SePay notifies each property's IPN URL (/api/webhooks/sepay/<propertyId>)
 *   with an X-Secret-Key header when the hotel sets that up. The notification
 *   is only a nudge: the order is read back from SePay's API (Basic auth with
 *   the hotel's keys) and only an order SePay reports CAPTURED, for our
 *   invoice number and the exact amount, is recorded.
 * - A payment becomes PAID through one conditional update, whichever comes
 *   first: IPN or reconcile (syncSepayPayment, in the 10-minute job). Money
 *   for a payment cancelled meanwhile is still recorded and flagged; a
 *   REFUNDED (or partly refunded, PROCESSING) payment is never brought back.
 * - The return URLs never mark anything paid.
 *
 * SEPAY_API_BASE_URL / SEPAY_CHECKOUT_BASE_URL are for tests only
 * (src/test/integration/fake-sepay.ts).
 */
import { randomInt, timingSafeEqual } from 'crypto'
import type { Prisma, PropertySepay } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, secretContext } from '@/lib/security/secret-box'
import { sendAfterResponse } from '@/lib/email/outbox'
import { lockBooking, syncBookingPayments } from './booking-payments'
import { queueGuestDepositReceived } from './deposit-received'
import { signCheckoutFields } from './sepay-sign'

export { signCheckoutFields }

export const SEPAY_ENVIRONMENTS = ['sandbox', 'production'] as const
export type SepayEnvironment = (typeof SEPAY_ENVIRONMENTS)[number]

const API_BASE: Record<SepayEnvironment, string> = {
  sandbox: 'https://pgapi-sandbox.sepay.vn',
  production: 'https://pgapi.sepay.vn',
}
const CHECKOUT_BASE: Record<SepayEnvironment, string> = {
  sandbox: 'https://pay-sandbox.sepay.vn',
  production: 'https://pay.sepay.vn',
}
const apiBase = (env: SepayEnvironment) => process.env.SEPAY_API_BASE_URL || API_BASE[env]
const checkoutBase = (env: SepayEnvironment) => process.env.SEPAY_CHECKOUT_BASE_URL || CHECKOUT_BASE[env]

const TIMEOUT_MS = 15_000
/** An order nobody paid (the guest left SePay's page) stops being checked after this. */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000

/** Payments in these statuses become PAID when SePay reports the money (PROCESSING: partly refunded, see payos.ts). */
const PAYABLE_STATUSES = ['PENDING', 'CANCELLED', 'EXPIRED', 'FAILED'] as const

export class SepayError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
    this.name = 'SepayError'
  }
}

const keyCtx = (propertyId: string) => secretContext('property_sepay', propertyId, 'secretKey')

export function ipnUrlFor(propertyId: string): string {
  return `${process.env.NEXTAUTH_URL}/api/webhooks/sepay/${propertyId}`
}

/** Our order_invoice_number: "SP" and 16 digits, unique across all payments (gatewayOrderCode). */
export function newInvoiceNumber(): string {
  return `SP${randomInt(10 ** 15, 10 ** 15 + 2 ** 48 - 1)}`
}

/** What the card statement and SePay's page show: ASCII, short. */
export function sepayDescription(bookingCode: string): string {
  return `Dat coc ${bookingCode.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 60)
}

interface Keys {
  propertyId: string
  merchantId: string
  secretKey: string
  environment: SepayEnvironment
}

const environmentOf = (value: string): SepayEnvironment => (value === 'production' ? 'production' : 'sandbox')

function keysOf(row: Pick<PropertySepay, 'propertyId' | 'merchantId' | 'secretKey' | 'environment'>): Keys {
  return {
    propertyId: row.propertyId,
    merchantId: row.merchantId,
    secretKey: decryptSecret(row.secretKey, keyCtx(row.propertyId)),
    environment: environmentOf(row.environment),
  }
}

/** One call to SePay's API with the hotel's keys. Throws SepayError when SePay cannot be reached. */
async function sepayApi(
  keys: Pick<Keys, 'merchantId' | 'secretKey' | 'environment'>,
  path: string,
  query: Record<string, string> = {}
): Promise<{ status: number; body: unknown }> {
  const qs = new URLSearchParams(query).toString()
  const auth = Buffer.from(`${keys.merchantId}:${keys.secretKey}`).toString('base64')
  try {
    const res = await fetch(`${apiBase(keys.environment)}/v1/${path}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  } catch (error) {
    throw new SepayError(`Không kết nối được SePay: ${(error as Error).message}`, 502)
  }
}

/** An order as SePay's API returns it (amounts come as strings, e.g. "500000.00"). */
export interface SepayOrder {
  order_id?: string
  order_invoice_number?: string
  order_status?: string
  order_amount?: string | number
  transactions?: {
    id?: string
    transaction_id?: string
    payment_method?: string
    transaction_status?: string
    transaction_date?: string
    card_brand?: string
    card_number?: string
  }[]
}

/** GET /v1/order/detail/<SePay's order id>; null when SePay does not know it. */
async function orderById(keys: Keys, orderId: string): Promise<SepayOrder | null> {
  const res = await sepayApi(keys, `order/detail/${encodeURIComponent(orderId)}`)
  if (res.status === 404) return null
  if (res.status !== 200) throw new SepayError(`SePay trả lỗi khi tra cứu đơn (HTTP ${res.status})`, 502)
  return ((res.body as { data?: SepayOrder })?.data ?? null) as SepayOrder | null
}

/**
 * Our order by its invoice number, before an IPN told us SePay's own id: a
 * keyword search, then the orders created that day (and the next, whatever
 * time zone SePay files them under).
 */
async function orderByInvoice(keys: Keys, invoiceNumber: string, createdAt: Date): Promise<SepayOrder | null> {
  const list = async (query: Record<string, string>) => {
    const res = await sepayApi(keys, 'order', query)
    if (res.status !== 200) throw new SepayError(`SePay trả lỗi khi tra cứu đơn (HTTP ${res.status})`, 502)
    const body = res.body as { data?: SepayOrder[]; meta?: { has_more?: boolean } } | null
    return { orders: Array.isArray(body?.data) ? body.data : [], more: Boolean(body?.meta?.has_more) }
  }
  const match = (orders: SepayOrder[]) => orders.find((o) => o.order_invoice_number === invoiceNumber) ?? null

  const searched = match((await list({ q: invoiceNumber, per_page: '20' })).orders)
  if (searched) return searched
  for (const offset of [0, 1]) {
    const day = new Date(createdAt.getTime() + 7 * 60 * 60 * 1000 + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    for (let page = 1; page <= 3; page++) {
      const { orders, more } = await list({ created_at: day, per_page: '100', page: String(page) })
      const found = match(orders)
      if (found) return found
      if (!more) break
    }
  }
  return null
}

export async function getSepayStatus(propertyId: string) {
  const row = await prisma.propertySepay.findUnique({
    where: { propertyId },
    select: { merchantId: true, environment: true, verifiedAt: true },
  })
  return {
    connected: Boolean(row?.verifiedAt),
    merchantIdHint: row ? `••••${row.merchantId.slice(-4)}` : null,
    environment: row ? environmentOf(row.environment) : null,
    connectedAt: row?.verifiedAt ?? null,
    ipnUrl: ipnUrlFor(propertyId),
  }
}

/**
 * Checks the keys with SePay (a one-order listing), then saves them. Keys
 * SePay refuses are never stored, and the previous connection stays.
 */
export async function connectSepay(
  propertyId: string,
  input: { merchantId: string; secretKey: string; environment: SepayEnvironment },
  userId: string
) {
  const keys = { merchantId: input.merchantId.trim(), secretKey: input.secretKey.trim(), environment: input.environment }
  const res = await sepayApi(keys, 'order', { per_page: '1' })
  if (res.status === 401 || res.status === 403) {
    throw new SepayError('SePay từ chối Merchant ID hoặc Secret key (kiểm tra cả môi trường Sandbox / Production)')
  }
  if (res.status !== 200) throw new SepayError(`SePay chưa trả lời được (HTTP ${res.status}), vui lòng thử lại`, 502)

  const data = {
    merchantId: keys.merchantId,
    secretKey: encryptSecret(keys.secretKey, keyCtx(propertyId)),
    environment: keys.environment,
    verifiedAt: new Date(),
    connectedById: userId,
  }
  await prisma.propertySepay.upsert({ where: { propertyId }, create: { propertyId, ...data }, update: data })
  return getSepayStatus(propertyId)
}

export async function disconnectSepay(propertyId: string): Promise<void> {
  await prisma.propertySepay.deleteMany({ where: { propertyId } })
}

async function connectedKeys(propertyId: string): Promise<Keys> {
  const row = await prisma.propertySepay.findUnique({ where: { propertyId } })
  if (!row?.verifiedAt) throw new SepayError('Khách sạn chưa kết nối SePay (Tài khoản ngân hàng → Thanh toán thẻ)')
  return keysOf(row)
}

/**
 * The signed form that sends the guest to SePay's card page for a PENDING
 * payment the caller just recorded (gatewayOrderCode set). Fields stay in
 * this order: the signature covers them as sent.
 */
export async function sepayCheckout(paymentId: string, urls: { success: string; error: string; cancel: string }) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { amount: true, propertyId: true, gatewayOrderCode: true, booking: { select: { bookingCode: true } } },
  })
  if (!payment.gatewayOrderCode) throw new SepayError('Khoản này không thanh toán qua SePay')
  const keys = await connectedKeys(payment.propertyId)
  const fields: [string, string][] = [
    ['merchant', keys.merchantId],
    ['currency', 'VND'],
    ['order_amount', String(Math.round(payment.amount))],
    ['operation', 'PURCHASE'],
    ['order_description', sepayDescription(payment.booking.bookingCode)],
    ['payment_method', 'CARD'],
    ['order_invoice_number', payment.gatewayOrderCode],
    ['success_url', urls.success],
    ['error_url', urls.error],
    ['cancel_url', urls.cancel],
  ]
  fields.push(['signature', signCheckoutFields(fields, keys.secretKey)])
  return { action: `${checkoutBase(keys.environment)}/v1/checkout/init`, fields }
}

function asObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Prisma.JsonObject) : {}
}

export type PaidOutcome = 'paid' | 'duplicate' | 'unknown' | 'amount_mismatch' | 'not_payable'

/**
 * Records money SePay reports (CAPTURED) for one of this property's
 * payments. Safe to call any number of times, from the IPN and reconcile at once.
 */
export async function applySepayPaid(input: {
  propertyId: string
  invoiceNumber: string
  order: SepayOrder
  source: 'ipn' | 'reconcile'
}): Promise<PaidOutcome> {
  const payment = await prisma.payment.findFirst({
    where: { propertyId: input.propertyId, paymentGateway: 'SEPAY', gatewayOrderCode: input.invoiceNumber },
    select: { id: true, bookingId: true, amount: true, status: true, metadata: true },
  })
  if (!payment) return 'unknown'
  if (payment.status === 'PAID') return 'duplicate'
  if (!(PAYABLE_STATUSES as readonly string[]).includes(payment.status)) return 'not_payable'

  const amount = Number(input.order.order_amount)
  const transaction = input.order.transactions?.find((t) => t.transaction_status === 'APPROVED') ?? input.order.transactions?.[0]
  const reference = transaction?.transaction_id ?? transaction?.id ?? null
  const sepayMeta = (extra: Prisma.JsonObject) => ({
    ...asObject(payment.metadata),
    sepay: { ...asObject(asObject(payment.metadata).sepay as Prisma.JsonValue), orderId: input.order.order_id ?? null, ...extra },
  })

  if (!Number.isFinite(amount) || Math.round(amount) !== Math.round(payment.amount)) {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { metadata: sepayMeta({ amountMismatch: input.order.order_amount ?? null }) } }),
      prisma.activityLog.create({
        data: {
          propertyId: input.propertyId,
          action: 'SEPAY_AMOUNT_MISMATCH',
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: { expected: payment.amount, received: input.order.order_amount ?? null, orderId: input.order.order_id ?? null },
        },
      }),
    ])
    return 'amount_mismatch'
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, payment.bookingId)
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: [...PAYABLE_STATUSES] } },
      data: { status: 'PAID', paidAt: new Date(), transactionId: reference },
    })
    if (claimed.count === 0) return { outcome: 'duplicate' as const, emailIds: [] }

    const late = payment.status !== 'PENDING'
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        metadata: sepayMeta({
          reference,
          paymentMethod: transaction?.payment_method ?? null,
          cardBrand: transaction?.card_brand ?? null,
          cardNumber: transaction?.card_number ?? null,
          transactionDate: transaction?.transaction_date ?? null,
          confirmedBy: input.source,
          ...(late && { paidAfter: payment.status }),
        }),
      },
    })
    const { closed } = await syncBookingPayments(tx, payment.bookingId)
    await tx.activityLog.create({
      data: {
        propertyId: input.propertyId,
        action: 'SEPAY_PAID',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: {
          bookingId: payment.bookingId,
          amount: payment.amount,
          reference,
          source: input.source,
          ...(late && { paidAfter: payment.status }),
          ...(closed && { paidAfterClosed: true }),
        },
      },
    })
    return { outcome: 'paid' as const, emailIds: await queueGuestDepositReceived(tx, payment, closed) }
  })
  sendAfterResponse(result.emailIds)
  return result.outcome
}

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The IPN of one property. A wrong X-Secret-Key is refused (401); without
 * one (the hotel did not set that up) the order is still read back from
 * SePay, which is what decides. Answers 200 for whatever SePay should not
 * resend.
 */
export async function handleSepayIpn(
  propertyId: string,
  secretHeader: string | null,
  body: unknown
): Promise<{ status: number; outcome: string }> {
  const row = await prisma.propertySepay.findUnique({ where: { propertyId } })
  if (!row?.verifiedAt) return { status: 404, outcome: 'not_connected' }
  const keys = keysOf(row)
  if (secretHeader !== null && !sameSecret(secretHeader, keys.secretKey)) return { status: 401, outcome: 'invalid_secret' }

  const notification = body as { notification_type?: unknown; order?: { order_id?: unknown; order_invoice_number?: unknown } } | null
  if (notification?.notification_type !== 'ORDER_PAID') return { status: 200, outcome: 'ignored' }
  const orderId = notification.order?.order_id
  const invoiceNumber = notification.order?.order_invoice_number
  if (typeof orderId !== 'string' || typeof invoiceNumber !== 'string' || !orderId || !invoiceNumber) {
    return { status: 400, outcome: 'malformed' }
  }

  // Never the notification's word: SePay's API says whether it is paid.
  const order = await orderById(keys, orderId)
  if (!order || order.order_invoice_number !== invoiceNumber) return { status: 200, outcome: 'unknown' }
  if (order.order_status !== 'CAPTURED') return { status: 200, outcome: 'not_captured' }
  const outcome = await applySepayPaid({ propertyId, invoiceNumber, order, source: 'ipn' })
  return { status: 200, outcome }
}

/**
 * Asks SePay about a card payment and applies the answer: after the guest
 * comes back from SePay, from reconcile, and before a deposit deadline
 * cancels a booking. Returns the payment's status afterwards.
 */
export async function syncSepayPayment(paymentId: string, now = new Date()) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { id: true, propertyId: true, status: true, gatewayOrderCode: true, createdAt: true, metadata: true },
  })
  if (!payment.gatewayOrderCode) throw new SepayError('Khoản này không thanh toán qua SePay')
  if (payment.status === 'PAID') return 'PAID'

  const keys = await connectedKeys(payment.propertyId)
  const knownId = asObject(asObject(payment.metadata).sepay as Prisma.JsonValue).orderId
  const order =
    typeof knownId === 'string' && knownId
      ? await orderById(keys, knownId)
      : await orderByInvoice(keys, payment.gatewayOrderCode, payment.createdAt)

  if (order?.order_status === 'CAPTURED') {
    await applySepayPaid({ propertyId: payment.propertyId, invoiceNumber: payment.gatewayOrderCode, order, source: 'reconcile' })
  } else if (order?.order_status === 'CANCELLED') {
    await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'CANCELLED' } })
  } else if (now.getTime() - payment.createdAt.getTime() > ABANDONED_AFTER_MS) {
    // Never paid on SePay's page (or never reached it): stop asking.
    await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
  }
  const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } })
  return after.status
}

/**
 * Closes a card payment nobody completed (a deposit deadline passed): asks
 * SePay first, so a payment made meanwhile is applied instead.
 */
export async function closeSepayPayment(paymentId: string) {
  const status = await syncSepayPayment(paymentId)
  if (status !== 'PENDING') return status
  await prisma.payment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status: 'CANCELLED' } })
  return 'CANCELLED'
}

/** Links live a day; a little longer catches late answers. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000
const MAX_PER_RUN = 100

export interface SepayReconcileSummary {
  checked: number
  paid: number
  errors: number
}

/** The 10-minute job: pending card payments whose IPN never came. */
export async function reconcilePendingSepay(now = new Date()): Promise<SepayReconcileSummary> {
  const pending = await prisma.payment.findMany({
    where: {
      paymentGateway: 'SEPAY',
      status: 'PENDING',
      gatewayOrderCode: { not: null },
      createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS) },
    },
    select: { id: true, propertyId: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_PER_RUN,
  })
  const summary: SepayReconcileSummary = { checked: 0, paid: 0, errors: 0 }
  for (const payment of pending) {
    summary.checked++
    try {
      if ((await syncSepayPayment(payment.id, now)) === 'PAID') {
        summary.paid++
        console.warn(`[sepay] reconcile found payment ${payment.id} paid without an IPN (property ${payment.propertyId}): check its IPN URL`)
      }
    } catch (error) {
      // One hotel's SePay being unreachable (or disconnected) must not stop the others.
      summary.errors++
      if (!(error instanceof SepayError)) console.error(`[sepay] reconcile ${payment.id} failed:`, error)
    }
  }
  return summary
}
