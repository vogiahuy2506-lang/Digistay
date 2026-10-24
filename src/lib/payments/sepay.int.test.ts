/**
 * Card payments through each hotel's SePay account (task 34), against real
 * Postgres and a fake SePay over HTTP (src/test/integration/fake-sepay.ts):
 * connecting, the guest's card deposit, the IPN (never trusted on its own),
 * reconcile, and the deposit deadline.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
      get: async (k: string) => data.get(k) ?? null,
      set: async (k: string, v: string) => (data.set(k, v), 'OK'),
      del: async (k: string) => (data.delete(k) ? 1 : 0),
      incr: async (k: string) => {
        const n = Number(data.get(k) ?? 0) + 1
        data.set(k, String(n))
        return n
      },
      expire: async () => 1,
      ttl: async () => 600,
    },
  }
})
vi.mock('@/lib/db/redis', () => ({ redis: store.redis }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encryptSecret, secretContext } from '@/lib/security/secret-box'
import { createBooking, createTenant, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { FakeSepay, type FakeSepayAccount } from '@/test/integration/fake-sepay'
import { FakePayos, type FakeAccount } from '@/test/integration/fake-payos'
import { depositToken } from './deposit-link'
import { expireUnpaidDeposits } from './guest-deposit'
import { connectSepay, reconcilePendingSepay, signCheckoutFields, syncSepayPayment } from './sepay'
import { PUT as connectRoute } from '@/app/api/properties/[id]/sepay/route'
import { POST as ipnRoute } from '@/app/api/webhooks/sepay/[propertyId]/route'
import { POST as cardRoute } from '@/app/api/public/deposits/[token]/card/route'

const fake = new FakeSepay()
// The deadline job asks PayOS about the booking's QR link too.
const payos = new FakePayos()
const PAYOS_ACCOUNT: FakeAccount = { clientId: 'client-p', apiKey: 'api-key-p', checksumKey: 'checksum-key-p' }
const ACCOUNT: FakeSepayAccount = { merchantId: 'MERCHANT-A', secretKey: 'secret-key-a' }
const OTHER: FakeSepayAccount = { merchantId: 'MERCHANT-B', secretKey: 'secret-key-b' }
const env = { api: process.env.SEPAY_API_BASE_URL, checkout: process.env.SEPAY_CHECKOUT_BASE_URL, payos: process.env.PAYOS_BASE_URL, url: process.env.NEXTAUTH_URL, keys: process.env.DATA_ENCRYPTION_KEYS }

beforeAll(async () => {
  await fake.start()
  fake.addAccount(ACCOUNT)
  fake.addAccount(OTHER)
  process.env.SEPAY_API_BASE_URL = fake.url
  process.env.SEPAY_CHECKOUT_BASE_URL = fake.url
  await payos.start()
  payos.addAccount(PAYOS_ACCOUNT)
  process.env.PAYOS_BASE_URL = payos.url
  process.env.NEXTAUTH_URL = 'https://digistay.test'
  process.env.DATA_ENCRYPTION_KEYS ??= `test:${randomBytes(32).toString('base64')}`
  process.env.NEXTAUTH_SECRET ??= 'sepay-test-secret'
})

afterAll(async () => {
  await fake.stop()
  await payos.stop()
  process.env.SEPAY_API_BASE_URL = env.api
  process.env.SEPAY_CHECKOUT_BASE_URL = env.checkout
  process.env.PAYOS_BASE_URL = env.payos
  process.env.NEXTAUTH_URL = env.url
  process.env.DATA_ENCRYPTION_KEYS = env.keys
  await prisma.$disconnect()
})

beforeEach(async () => {
  await resetDatabase()
  store.data.clear()
  fake.orders.clear()
  fake.sendSecretHeader = true
  vi.mocked(auth).mockReset()
})

const ipn = (propertyId: string, body: object, secret: string | null = ACCOUNT.secretKey) =>
  ipnRoute(
    new NextRequest(`http://digistay.test/api/webhooks/sepay/${propertyId}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'x-real-ip': '203.0.113.20', ...(secret !== null && { 'x-secret-key': secret }) },
    }),
    { params: Promise.resolve({ propertyId }) }
  )

/** A hotel taking 30% online deposits, with PayOS on record and SePay connected; a guest booking waiting for it. */
async function hotelWithCardDeposit(opts: { deadlineMinutes?: number } = {}) {
  const { owner, property } = await createTenant()
  await publishSite(property.id)
  await prisma.policy.create({ data: { propertyId: property.id, onlineDepositPercent: 30, depositDeadlineMinutes: opts.deadlineMinutes ?? 0 } })
  // Deposits need PayOS (guest-deposit.ts): the fake one.
  await prisma.propertyPayos.create({
    data: {
      propertyId: property.id,
      clientId: PAYOS_ACCOUNT.clientId,
      apiKey: encryptSecret(PAYOS_ACCOUNT.apiKey, secretContext('property_payos', property.id, 'apiKey')),
      checksumKey: encryptSecret(PAYOS_ACCOUNT.checksumKey, secretContext('property_payos', property.id, 'checksumKey')),
      webhookConfirmedAt: new Date(),
    },
  })
  await connectSepay(property.id, { ...ACCOUNT, environment: 'sandbox' }, owner.id)
  const booking = await createBooking(property.id, { totalAmount: 1_000_000 })
  return { owner, property, booking }
}

async function startCard(bookingId: string) {
  const res = await cardRoute(
    new NextRequest(`http://digistay.test/api/public/deposits/x/card`, { method: 'POST', headers: { 'x-real-ip': '198.51.100.30' } }),
    { params: Promise.resolve({ token: depositToken(bookingId) }) }
  )
  return { status: res.status, body: await res.json() }
}

/** The guest's browser posts the signed form to SePay, which creates the order. */
async function postCheckout(form: { action: string; fields: [string, string][] }) {
  return fetch(form.action, { method: 'POST', body: new URLSearchParams(form.fields), redirect: 'manual' })
}

describe('signCheckoutFields', () => {
  it('matches an independent HMAC-SHA256 over the fields in the order sent', () => {
    const fields: [string, string][] = [
      ['merchant', 'M1'], ['currency', 'VND'], ['order_amount', '300000'], ['operation', 'PURCHASE'],
      ['order_description', 'Dat coc DS1'], ['payment_method', 'CARD'], ['order_invoice_number', 'SP1'],
      ['success_url', 'https://a/s'], ['error_url', 'https://a/e'], ['cancel_url', 'https://a/c'], ['custom_data', 'not signed'],
    ]
    expect(signCheckoutFields(fields, 'sk')).toBe('txS2JdNYO2poO/m9Qd4ZTEd+GQz3KLtYDH10/FPHsxU=')
  })
})

describe('connecting', () => {
  it('keys SePay refuses are never stored; good keys are kept encrypted', async () => {
    const { owner, property } = await createTenant()
    vi.mocked(auth).mockResolvedValue({ user: { id: owner.id, email: owner.email } } as never)
    const put = (body: object) =>
      connectRoute(
        new NextRequest(`http://digistay.test/api/properties/${property.id}/sepay`, { method: 'PUT', body: JSON.stringify(body) }),
        { params: Promise.resolve({ id: property.id }) }
      )

    const wrong = await put({ merchantId: ACCOUNT.merchantId, secretKey: 'wrong', environment: 'sandbox' })
    expect(wrong.status).toBe(400)
    expect(await prisma.propertySepay.count()).toBe(0)

    const ok = await put({ ...ACCOUNT, environment: 'sandbox' })
    expect(ok.status).toBe(200)
    expect((await ok.json()).data).toMatchObject({ connected: true, merchantIdHint: '••••NT-A', environment: 'sandbox', ipnUrl: `https://digistay.test/api/webhooks/sepay/${property.id}` })
    const row = await prisma.propertySepay.findUniqueOrThrow({ where: { propertyId: property.id } })
    expect(row.secretKey).not.toContain(ACCOUNT.secretKey)
  })
})

describe('a guest pays the deposit by card', () => {
  it('the signed form creates the order at SePay; the IPN, checked against the API, confirms the booking', async () => {
    const { property, booking } = await hotelWithCardDeposit()
    fake.ipnUrls.set(ACCOUNT.merchantId, `https://unused`)

    const started = await startCard(booking.id)
    expect(started.status).toBe(200)
    const form = started.body.data as { action: string; fields: [string, string][] }
    expect(form.action).toBe(`${fake.url}/v1/checkout/init`)
    const field = (name: string) => form.fields.find(([k]) => k === name)?.[1]
    expect([field('order_amount'), field('payment_method'), field('currency')]).toEqual(['300000', 'CARD', 'VND'])
    expect(field('success_url')).toContain(`/dat-coc/${depositToken(booking.id)}?card=success`)
    expect((await postCheckout(form)).status).toBe(200) // the fake checked the signature

    const invoice = field('order_invoice_number')!
    const payment = await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: invoice } })
    expect(payment).toMatchObject({ status: 'PENDING', paymentGateway: 'SEPAY', method: 'CREDIT_CARD', amount: 300_000 })

    const body = fake.pay(invoice)
    expect((await ipn(property.id, body)).status).toBe(200)
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(after.status).toBe('PAID')
    expect(after.transactionId).toBe(`TXN${invoice}`)
    expect(after.metadata).toMatchObject({ sepay: { orderId: fake.orders.get(invoice)!.order_id, cardBrand: 'VISA', confirmedBy: 'ipn' } })
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'CONFIRMED', depositAmount: 300_000, paymentStatus: 'PARTIAL' })
    expect(await prisma.emailOutbox.count({ where: { refId: booking.id, kind: 'deposit_received' } })).toBe(1)

    // Sent again: nothing changes.
    expect((await ipn(property.id, body)).status).toBe(200)
    expect(await prisma.activityLog.count({ where: { action: 'SEPAY_PAID' } })).toBe(1)
  })

  it('a forged or premature IPN changes nothing: the API decides', async () => {
    const { property, booking } = await hotelWithCardDeposit()
    const form = (await startCard(booking.id)).body.data
    await postCheckout(form)
    const invoice = form.fields.find(([k]: [string, string]) => k === 'order_invoice_number')[1]
    const order = fake.orders.get(invoice)!

    // The order exists but is not paid; the notification claims it is.
    const claim = { ...fake.ipnBody(order), order: { ...fake.ipnBody(order).order, order_status: 'CAPTURED' } }
    expect((await ipn(property.id, claim)).status).toBe(200)
    // Someone else's order id with our invoice number.
    expect((await ipn(property.id, { ...claim, order: { ...claim.order, order_id: 'SEPAY-NOPE' } })).status).toBe(200)
    // A wrong secret is refused outright.
    expect((await ipn(property.id, claim, 'guess')).status).toBe(401)
    expect((await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: invoice } })).status).toBe('PENDING')
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('PENDING')
  })

  it('without the secret header (not set up by the hotel) the API still decides', async () => {
    const { property, booking } = await hotelWithCardDeposit()
    const form = (await startCard(booking.id)).body.data
    await postCheckout(form)
    const invoice = form.fields.find(([k]: [string, string]) => k === 'order_invoice_number')[1]
    expect((await ipn(property.id, fake.pay(invoice), null)).status).toBe(200)
    expect((await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: invoice } })).status).toBe('PAID')
  })

  it('a different amount is flagged, never recorded', async () => {
    const { property, booking } = await hotelWithCardDeposit()
    const form = (await startCard(booking.id)).body.data
    await postCheckout(form)
    const invoice = form.fields.find(([k]: [string, string]) => k === 'order_invoice_number')[1]
    expect((await ipn(property.id, fake.pay(invoice, 1_000))).status).toBe(200)
    expect((await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: invoice } })).status).toBe('PENDING')
    expect(await prisma.activityLog.count({ where: { action: 'SEPAY_AMOUNT_MISMATCH' } })).toBe(1)
  })

  it("another hotel's IPN URL cannot confirm this hotel's payment", async () => {
    const { booking } = await hotelWithCardDeposit()
    const other = await createTenant()
    await connectSepay(other.property.id, { ...OTHER, environment: 'sandbox' }, other.owner.id)
    const form = (await startCard(booking.id)).body.data
    await postCheckout(form)
    const invoice = form.fields.find(([k]: [string, string]) => k === 'order_invoice_number')[1]
    const body = fake.pay(invoice)
    expect((await ipn(other.property.id, body, OTHER.secretKey)).status).toBe(200) // unknown there
    expect((await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: invoice } })).status).toBe('PENDING')
  })

  it('a missed IPN is applied by reconcile, found by invoice number', async () => {
    const { booking } = await hotelWithCardDeposit()
    const form = (await startCard(booking.id)).body.data
    await postCheckout(form)
    const invoice = form.fields.find(([k]: [string, string]) => k === 'order_invoice_number')[1]
    fake.pay(invoice)

    expect(await reconcilePendingSepay()).toMatchObject({ checked: 1, paid: 1, errors: 0 })
    expect((await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: invoice } })).status).toBe('PAID')
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
  })

  it('an order never paid stays pending, then stops being checked after a day', async () => {
    const { booking } = await hotelWithCardDeposit()
    const form = (await startCard(booking.id)).body.data
    await postCheckout(form)
    const payment = await prisma.payment.findFirstOrThrow({ where: { paymentGateway: 'SEPAY' } })
    expect(await syncSepayPayment(payment.id)).toBe('PENDING')
    expect(await syncSepayPayment(payment.id, new Date(Date.now() + 25 * 3_600_000))).toBe('EXPIRED')
  })

  it('is refused once paid, and when the hotel has no SePay', async () => {
    const { property, booking } = await hotelWithCardDeposit()
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } })
    expect((await startCard(booking.id)).body).toMatchObject({ success: true, data: { paid: true } })

    const other = await createBooking(property.id, { totalAmount: 500_000 })
    await prisma.propertySepay.delete({ where: { propertyId: property.id } })
    const refused = await startCard(other.id)
    expect(refused.status).toBe(409)
    expect(await prisma.payment.count({ where: { bookingId: other.id } })).toBe(0)
  })
})

describe('the deposit deadline', () => {
  /** The QR deposit made with the booking (PayOS), its link expired at PayOS, its deadline 20 minutes from now. */
  async function payosDeposit(booking: { id: string; propertyId: string }, orderCode: number) {
    const deadline = new Date(Date.now() + 20 * 60_000)
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        propertyId: booking.propertyId,
        amount: 300_000,
        netAmount: 300_000,
        method: 'QR_VIETQR',
        status: 'PENDING',
        paymentGateway: 'PAYOS',
        gatewayOrderCode: String(orderCode),
        expiresAt: deadline,
        metadata: { guestDeposit: true, percent: 30, autoCancel: true, deadlineMinutes: 30, deadline: deadline.toISOString() },
      },
    })
    payos.links.set(orderCode, {
      orderCode,
      amount: 300_000,
      amountPaid: 0,
      description: 'deposit',
      status: 'EXPIRED',
      account: PAYOS_ACCOUNT,
      transactions: [],
    })
  }

  it('asks SePay before cancelling: a card paid without an IPN confirms the booking instead', async () => {
    const { booking } = await hotelWithCardDeposit({ deadlineMinutes: 30 })
    await payosDeposit(booking, 1_000_000_000_000_001)
    const form = (await startCard(booking.id)).body.data
    await postCheckout(form)
    fake.pay(form.fields.find(([k]: [string, string]) => k === 'order_invoice_number')[1])

    expect(await expireUnpaidDeposits(new Date(Date.now() + 40 * 60_000))).toMatchObject({ checked: 1, paid: 1, cancelled: 0 })
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
  })

  it('cancels the booking when neither PayOS nor SePay has the money, and closes the card order', async () => {
    const { booking } = await hotelWithCardDeposit({ deadlineMinutes: 30 })
    await payosDeposit(booking, 1_000_000_000_000_002)
    await postCheckout((await startCard(booking.id)).body.data)

    expect(await expireUnpaidDeposits(new Date(Date.now() + 40 * 60_000))).toMatchObject({ checked: 1, paid: 0, cancelled: 1 })
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED')
    expect((await prisma.payment.findFirstOrThrow({ where: { paymentGateway: 'SEPAY' } })).status).toBe('CANCELLED')
  })

  it('never cancels blind when SePay cannot be asked', async () => {
    const { booking, property } = await hotelWithCardDeposit({ deadlineMinutes: 30 })
    await payosDeposit(booking, 1_000_000_000_000_003)
    await postCheckout((await startCard(booking.id)).body.data)
    // The hotel's keys stop working at SePay.
    await prisma.propertySepay.update({
      where: { propertyId: property.id },
      data: { secretKey: encryptSecret('revoked', secretContext('property_sepay', property.id, 'secretKey')) },
    })

    expect(await expireUnpaidDeposits(new Date(Date.now() + 40 * 60_000))).toMatchObject({ checked: 1, cancelled: 0, errors: 1 })
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('PENDING')
  })
})
