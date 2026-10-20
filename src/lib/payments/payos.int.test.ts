/**
 * PayOS per property against real Postgres and the real SDK, which talks
 * HTTP to a fake PayOS (src/test/integration/fake-payos.ts): connecting,
 * links, webhooks, reconcile, cancel, and the cash paths that now keep the
 * booking's deposit and payment status right (Part 5).
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
import { createBooking, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { FakePayos, type FakeAccount } from '@/test/integration/fake-payos'
import { PayosError, applyPayosPaid, connectPayos, syncPayosPayment } from './payos'
import { POST as createPayment } from '@/app/api/payments/route'
import { POST as webhook } from '@/app/api/webhooks/payos/[propertyId]/route'
import { POST as syncRoute } from '@/app/api/payments/[id]/sync/route'
import { POST as cancelRoute } from '@/app/api/payments/[id]/cancel/route'
import { POST as extendRoute } from '@/app/api/bookings/[id]/extend/route'
import { POST as reconcileRoute } from '@/app/api/internal/payos-reconcile/route'

const fake = new FakePayos()
const ACCOUNT_A: FakeAccount = { clientId: 'client-a', apiKey: 'api-key-a', checksumKey: 'checksum-key-a' }
const ACCOUNT_B: FakeAccount = { clientId: 'client-b', apiKey: 'api-key-b', checksumKey: 'checksum-key-b' }
const env = { base: process.env.PAYOS_BASE_URL, url: process.env.NEXTAUTH_URL }

function postWebhook(propertyId: string, body: object) {
  return webhook(
    new NextRequest(`http://digistay.test/api/webhooks/payos/${propertyId}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'x-real-ip': '203.0.113.10' },
    }),
    { params: Promise.resolve({ propertyId }) }
  )
}

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

async function createPayosPayment(bookingId: string, amount: number) {
  const res = await createPayment(
    new NextRequest('http://digistay.test/api/payments', {
      method: 'POST',
      body: JSON.stringify({ bookingId, method: 'PAYOS', amount }),
    })
  )
  return { res, body: await res.json() }
}

/** A tenant whose property is connected to `account`, with a 2M booking. */
async function connectedTenant(account = ACCOUNT_A) {
  const tenant = await createTenant()
  await connectPayos(tenant.property.id, account, tenant.owner.id)
  const booking = await createBooking(tenant.property.id, { totalAmount: 2_000_000 })
  signInAs(tenant.owner)
  return { ...tenant, booking }
}

const bookingOf = (id: string) =>
  prisma.booking.findUniqueOrThrow({ where: { id }, select: { status: true, paymentStatus: true, depositAmount: true } })

beforeAll(async () => {
  await fake.start()
  fake.addAccount(ACCOUNT_A)
  fake.addAccount(ACCOUNT_B)
  // PayOS calls our webhook during confirm-webhook: route it to the handler.
  fake.deliver = async (url, body) => (await postWebhook(url.split('/').pop()!, body)).status
  process.env.PAYOS_BASE_URL = fake.url
  process.env.NEXTAUTH_URL = 'http://digistay.test'
})
beforeEach(async () => {
  await resetDatabase()
  store.data.clear()
  fake.links.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(async () => {
  await fake.stop()
  process.env.PAYOS_BASE_URL = env.base
  process.env.NEXTAUTH_URL = env.url
  await prisma.$disconnect()
})

describe('connecting a property', () => {
  it('registers the webhook (PayOS calls it) and stores the keys encrypted', async () => {
    const tenant = await createTenant()
    const status = await connectPayos(tenant.property.id, ACCOUNT_A, tenant.owner.id)
    expect(status).toMatchObject({ connected: true, accountNumber: '0011223344', clientIdHint: '••••nt-a' })
    expect(fake.confirmCalls.at(-1)).toEqual({
      webhookUrl: `http://digistay.test/api/webhooks/payos/${tenant.property.id}`,
      status: 200,
    })
    const row = await prisma.propertyPayos.findUniqueOrThrow({ where: { propertyId: tenant.property.id } })
    expect(row.apiKey.startsWith('v1.')).toBe(true)
    expect(row.checksumKey.startsWith('v1.')).toBe(true)
    expect(`${row.apiKey}${row.checksumKey}`).not.toContain('key-a')
  })

  it('wrong keys store nothing, and never replace keys that work', async () => {
    const tenant = await createTenant()
    await expect(
      connectPayos(tenant.property.id, { ...ACCOUNT_A, apiKey: 'wrong' }, tenant.owner.id)
    ).rejects.toThrow(PayosError)
    expect(await prisma.propertyPayos.count()).toBe(0)

    await connectPayos(tenant.property.id, ACCOUNT_A, tenant.owner.id)
    await expect(
      connectPayos(tenant.property.id, { ...ACCOUNT_B, checksumKey: 'not-b' }, tenant.owner.id)
    ).rejects.toThrow('PayOS từ chối kết nối')
    const booking = await createBooking(tenant.property.id, { totalAmount: 500_000 })
    signInAs(tenant.owner)
    expect((await createPayosPayment(booking.id, 500_000)).res.status).toBe(200)
  })
})

describe('payment links', () => {
  it('records the order code before PayOS hears of it, then stores link and QR', async () => {
    const { booking } = await connectedTenant()
    const { res, body } = await createPayosPayment(booking.id, 500_000)
    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({
      status: 'PENDING',
      method: 'QR_VIETQR',
      paymentGateway: 'PAYOS',
      checkoutUrl: expect.stringContaining('pay.payos.vn'),
      qrCodeUrl: expect.stringContaining('FAKE'),
    })
    expect(body.data.gatewayOrderCode).toMatch(/^\d{16}$/)
    expect(fake.links.get(Number(body.data.gatewayOrderCode))).toMatchObject({ amount: 500_000, status: 'PENDING' })
  })

  it('refuses unconnected properties and amounts that are not whole dong', async () => {
    const tenant = await createTenant()
    const booking = await createBooking(tenant.property.id, { totalAmount: 1_000_000 })
    signInAs(tenant.owner)
    expect((await createPayosPayment(booking.id, 100_000)).res.status).toBe(400)

    const connected = await connectedTenant()
    expect((await createPayosPayment(connected.booking.id, 1000.5)).res.status).toBe(400)
  })
})

describe('webhook', () => {
  it('a paid link marks the payment PAID once and updates the booking', async () => {
    const { property, booking } = await connectedTenant()
    const { body } = await createPayosPayment(booking.id, 500_000)
    const paid = await fake.pay(Number(body.data.gatewayOrderCode))

    expect((await postWebhook(property.id, paid)).status).toBe(200)
    expect((await postWebhook(property.id, paid)).status).toBe(200) // PayOS resends

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: body.data.id } })
    expect(payment).toMatchObject({ status: 'PAID', transactionId: `FT${body.data.gatewayOrderCode}` })
    expect(await bookingOf(booking.id)).toEqual({ status: 'CONFIRMED', paymentStatus: 'PARTIAL', depositAmount: 500_000 })
    expect(await prisma.activityLog.count({ where: { action: 'PAYOS_PAID', entityId: payment.id } })).toBe(1)
  })

  it('rejects a bad signature and changes nothing', async () => {
    const { property, booking } = await connectedTenant()
    const { body } = await createPayosPayment(booking.id, 500_000)
    const paid = await fake.pay(Number(body.data.gatewayOrderCode))

    const forged = { ...paid, data: { ...paid.data, amount: 2_000_000 } }
    expect((await postWebhook(property.id, forged)).status).toBe(400)
    // Signed with another account's key.
    const otherKey = await fake.webhookBody(paid.data, ACCOUNT_B.checksumKey)
    expect((await postWebhook(property.id, otherKey)).status).toBe(400)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: body.data.id } })).status).toBe('PENDING')
  })

  it('only finds payments of the property in the URL', async () => {
    const a = await connectedTenant(ACCOUNT_A)
    const b = await connectedTenant(ACCOUNT_B)
    signInAs(a.owner)
    const { body } = await createPayosPayment(a.booking.id, 500_000)
    // B's correctly signed webhook naming A's order code.
    const viaB = await fake.webhookBody(
      { orderCode: Number(body.data.gatewayOrderCode), amount: 500_000, description: 'x' },
      ACCOUNT_B.checksumKey
    )
    expect((await postWebhook(b.property.id, viaB)).status).toBe(200)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: body.data.id } })).status).toBe('PENDING')
  })

  it('a different amount is not confirmed, but flagged for staff', async () => {
    const { property, booking } = await connectedTenant()
    const { body } = await createPayosPayment(booking.id, 500_000)
    const short = await fake.pay(Number(body.data.gatewayOrderCode), 50_000)
    expect((await postWebhook(property.id, short)).status).toBe(200)

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: body.data.id } })
    expect(payment.status).toBe('PENDING')
    expect(payment.metadata).toMatchObject({ payos: { amountMismatch: 50_000 } })
    expect(await prisma.activityLog.count({ where: { action: 'PAYOS_AMOUNT_MISMATCH' } })).toBe(1)
    expect((await bookingOf(booking.id)).depositAmount).toBe(0)
  })

  it('ignores non-success codes and unknown properties', async () => {
    const { property, booking } = await connectedTenant()
    const { body } = await createPayosPayment(booking.id, 500_000)
    const failed = await fake.webhookBody(
      { orderCode: Number(body.data.gatewayOrderCode), amount: 500_000, description: 'x' },
      ACCOUNT_A.checksumKey,
      '01'
    )
    expect((await postWebhook(property.id, failed)).status).toBe(200)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: body.data.id } })).status).toBe('PENDING')
    expect((await postWebhook('no-such-property', failed)).status).toBe(404)
  })

  it('money for a cancelled link is recorded and flagged; a refund is never undone', async () => {
    const { property, booking } = await connectedTenant()
    const first = await createPayosPayment(booking.id, 500_000)
    await prisma.payment.update({ where: { id: first.body.data.id }, data: { status: 'CANCELLED' } })
    const late = await fake.pay(Number(first.body.data.gatewayOrderCode))
    expect((await postWebhook(property.id, late)).status).toBe(200)
    const lateRow = await prisma.payment.findUniqueOrThrow({ where: { id: first.body.data.id } })
    expect(lateRow.status).toBe('PAID')
    expect(lateRow.metadata).toMatchObject({ payos: { paidAfter: 'CANCELLED' } })

    const second = await createPayosPayment(booking.id, 300_000)
    await prisma.payment.update({ where: { id: second.body.data.id }, data: { status: 'REFUNDED' } })
    const resent = await fake.pay(Number(second.body.data.gatewayOrderCode))
    expect((await postWebhook(property.id, resent)).status).toBe(200)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: second.body.data.id } })).status).toBe('REFUNDED')
  })

  it('webhook and reconcile racing apply the money once', async () => {
    const { property, booking } = await connectedTenant()
    const { body } = await createPayosPayment(booking.id, 2_000_000)
    const paid = await fake.pay(Number(body.data.gatewayOrderCode))
    await Promise.all([
      postWebhook(property.id, paid),
      syncPayosPayment(body.data.id),
      applyPayosPaid({ propertyId: property.id, orderCode: body.data.gatewayOrderCode, amount: 2_000_000, source: 'reconcile' }),
    ])
    expect(await prisma.activityLog.count({ where: { action: 'PAYOS_PAID' } })).toBe(1)
    expect(await bookingOf(booking.id)).toEqual({ status: 'CONFIRMED', paymentStatus: 'PAID', depositAmount: 2_000_000 })
  })

  it('five notifications read the payment at once: one claims it, the rest are duplicates', async () => {
    const { property, booking } = await connectedTenant()
    const { body } = await createPayosPayment(booking.id, 500_000)
    await fake.pay(Number(body.data.gatewayOrderCode))
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        applyPayosPaid({ propertyId: property.id, orderCode: body.data.gatewayOrderCode, amount: 500_000, source: 'webhook' })
      )
    )
    expect(outcomes.filter((o) => o === 'paid')).toHaveLength(1)
    expect(await prisma.activityLog.count({ where: { action: 'PAYOS_PAID' } })).toBe(1)
    expect((await bookingOf(booking.id)).depositAmount).toBe(500_000)
  })
})

describe('reconcile and cancel', () => {
  const action = (route: typeof syncRoute, id: string) =>
    route(new NextRequest(`http://digistay.test/api/payments/${id}/x`, { method: 'POST' }), {
      params: Promise.resolve({ id }),
    })

  it('"check now" picks up a payment whose webhook never came, and expiry', async () => {
    const { booking } = await connectedTenant()
    const paidLink = await createPayosPayment(booking.id, 400_000)
    await fake.pay(Number(paidLink.body.data.gatewayOrderCode)) // webhook lost
    expect(await (await action(syncRoute, paidLink.body.data.id)).json()).toMatchObject({ data: { status: 'PAID' } })
    expect((await bookingOf(booking.id)).depositAmount).toBe(400_000)

    const expired = await createPayosPayment(booking.id, 100_000)
    fake.links.get(Number(expired.body.data.gatewayOrderCode))!.status = 'EXPIRED'
    expect(await (await action(syncRoute, expired.body.data.id)).json()).toMatchObject({ data: { status: 'EXPIRED' } })
  })

  it('cancel cancels at PayOS; if the guest paid meanwhile, the money is kept', async () => {
    const { booking } = await connectedTenant()
    const unpaid = await createPayosPayment(booking.id, 100_000)
    expect(await (await action(cancelRoute, unpaid.body.data.id)).json()).toMatchObject({ data: { status: 'CANCELLED' } })
    expect(fake.links.get(Number(unpaid.body.data.gatewayOrderCode))!.status).toBe('CANCELLED')

    const paid = await createPayosPayment(booking.id, 200_000)
    await fake.pay(Number(paid.body.data.gatewayOrderCode))
    expect(await (await action(cancelRoute, paid.body.data.id)).json()).toMatchObject({ data: { status: 'PAID' } })
  })

  it('only staff of the property may check or cancel', async () => {
    const { booking } = await connectedTenant()
    const { body } = await createPayosPayment(booking.id, 100_000)
    const outsider = await createTenant()
    signInAs(outsider.owner)
    expect((await action(syncRoute, body.data.id)).status).toBe(404)
    expect((await action(cancelRoute, body.data.id)).status).toBe(404)
  })
})

describe('cash and extensions keep the booking right', () => {
  const cash = (bookingId: string, amount: number) =>
    createPayment(
      new NextRequest('http://digistay.test/api/payments', {
        method: 'POST',
        body: JSON.stringify({ bookingId, method: 'CASH', amount }),
      })
    )

  it('partial cash is PARTIAL with its deposit; the rest makes it PAID', async () => {
    const { owner, property } = await createTenant()
    const booking = await createBooking(property.id, { totalAmount: 2_000_000 })
    signInAs(owner)
    expect((await cash(booking.id, 200_000)).status).toBe(200)
    expect(await bookingOf(booking.id)).toEqual({ status: 'CONFIRMED', paymentStatus: 'PARTIAL', depositAmount: 200_000 })
    expect((await cash(booking.id, 1_800_000)).status).toBe(200)
    expect(await bookingOf(booking.id)).toEqual({ status: 'CONFIRMED', paymentStatus: 'PAID', depositAmount: 2_000_000 })
  })

  it('an unpaid extension turns a paid booking PARTIAL; paying it in cash counts', async () => {
    const { owner, property } = await createTenant()
    const roomType = await prisma.roomType.create({ data: { propertyId: property.id, name: 'Standard', slug: 'standard', bedType: 'DOUBLE' } })
    const pricing = await prisma.pricingConfig.create({
      data: { propertyId: property.id, weekdayPrice: 500_000, weekendPrice: 600_000 },
    })
    await prisma.roomTypePricing.create({
      data: { roomTypeId: roomType.id, pricingId: pricing.id, weekdayPrice: 500_000, weekendPrice: 600_000 },
    })
    const booking = await createBooking(property.id, { totalAmount: 1_000_000, status: 'CHECKED_IN' })
    await prisma.bookingItem.create({
      data: {
        bookingId: booking.id,
        roomTypeId: roomType.id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        basePrice: 500_000,
        totalPrice: 1_000_000,
      },
    })
    signInAs(owner)
    expect((await cash(booking.id, 1_000_000)).status).toBe(200)
    expect((await bookingOf(booking.id)).paymentStatus).toBe('PAID')

    const extend = (body: object) =>
      extendRoute(
        new NextRequest(`http://digistay.test/api/bookings/${booking.id}/extend`, { method: 'POST', body: JSON.stringify(body) }),
        { params: Promise.resolve({ id: booking.id }) }
      )
    const unpaid = await extend({ newCheckOutDate: '2026-11-04T12:00:00Z' })
    expect(unpaid.status).toBe(200)
    expect(await bookingOf(booking.id)).toMatchObject({ paymentStatus: 'PARTIAL', depositAmount: 1_000_000 })

    const paidNow = await extend({ newCheckOutDate: '2026-11-05T12:00:00Z', addPayment: true })
    const { additionalCharge } = await paidNow.json()
    expect(additionalCharge).toBeGreaterThan(0)
    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id, amount: additionalCharge } })
    expect(payment).toMatchObject({ method: 'CASH', status: 'PAID' })
    expect((await bookingOf(booking.id)).depositAmount).toBe(1_000_000 + additionalCharge)
  })
})

describe('scheduled reconcile', () => {
  const run = (secret?: string) =>
    reconcileRoute(
      new NextRequest('http://digistay.test/api/internal/payos-reconcile', {
        method: 'POST',
        headers: secret ? { 'x-cron-secret': secret } : {},
      })
    )
  const SECRET = randomBytes(24).toString('hex')

  it('needs the secret, then applies what PayOS says for every property', async () => {
    const a = await connectedTenant(ACCOUNT_A)
    const paid = await createPayosPayment(a.booking.id, 300_000)
    const expired = await createPayosPayment(a.booking.id, 200_000)
    const waiting = await createPayosPayment(a.booking.id, 100_000)
    await fake.pay(Number(paid.body.data.gatewayOrderCode)) // its webhook never arrives
    fake.links.get(Number(expired.body.data.gatewayOrderCode))!.status = 'EXPIRED'

    const b = await connectedTenant(ACCOUNT_B)
    await createPayosPayment(b.booking.id, 100_000)
    await prisma.propertyPayos.delete({ where: { propertyId: b.property.id } }) // disconnected since

    const previous = process.env.CRON_SECRET
    try {
      delete process.env.CRON_SECRET
      expect((await run(SECRET)).status).toBe(503)
      process.env.CRON_SECRET = SECRET
      expect((await run()).status).toBe(401)
      expect((await run(randomBytes(24).toString('hex'))).status).toBe(401) // same length, wrong value

      const warn = vi.mocked(console.warn)
      const res = await run(SECRET)
      expect(res.status).toBe(200)
      expect((await res.json()).data).toEqual({ checked: 4, paid: 1, expired: 1, cancelled: 0, errors: 1 })
      expect(warn.mock.calls.some(([m]) => String(m).includes('paid without a webhook'))).toBe(true)

      const status = (id: string) => prisma.payment.findUniqueOrThrow({ where: { id } }).then((p) => p.status)
      expect(await status(paid.body.data.id)).toBe('PAID')
      expect(await status(expired.body.data.id)).toBe('EXPIRED')
      expect(await status(waiting.body.data.id)).toBe('PENDING')
      expect((await bookingOf(a.booking.id)).depositAmount).toBe(300_000)

      // Running again changes nothing and checks only what is still pending.
      expect((await (await run(SECRET)).json()).data).toEqual({ checked: 2, paid: 0, expired: 0, cancelled: 0, errors: 1 })
      expect(await prisma.activityLog.count({ where: { action: 'PAYOS_PAID' } })).toBe(1)
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = previous
    }
  })
})
