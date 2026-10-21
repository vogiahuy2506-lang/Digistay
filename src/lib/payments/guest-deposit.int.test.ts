/**
 * A guest's deposit when booking on the hotel's site, against real
 * Postgres and the real PayOS SDK talking to a fake PayOS: the link is for
 * the hotel's share of what the booking is charged, only the webhook
 * confirms the booking and emails the guest, and a PayOS failure never
 * loses the booking.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

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
import { createRoomType, createTenant, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { FakePayos, type FakeAccount } from '@/test/integration/fake-payos'
import { applyPayosPaid, connectPayos } from './payos'
import { expireUnpaidDeposits } from './guest-deposit'
import { reconcilePendingPayos } from './payos-reconcile'
import { POST as guestBooking } from '@/app/api/public/bookings/route'
import { GET as publicProperty } from '@/app/api/properties/public/route'
import { GET as getPolicy, PATCH as patchPolicy } from '@/app/api/properties/[id]/policy/route'
import { POST as webhook } from '@/app/api/webhooks/payos/[propertyId]/route'

const fake = new FakePayos()
const ACCOUNT: FakeAccount = { clientId: 'client-dep', apiKey: 'api-key-dep', checksumKey: 'checksum-key-dep' }
const env = { base: process.env.PAYOS_BASE_URL, url: process.env.NEXTAUTH_URL }

const postWebhook = (propertyId: string, body: object) =>
  webhook(
    new NextRequest(`http://digistay.test/api/webhooks/payos/${propertyId}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'x-real-ip': '203.0.113.10' },
    }),
    { params: Promise.resolve({ propertyId }) }
  )

let ip = 0
async function book(propertyId: string, roomTypeId: string, email = 'khach@example.com') {
  const res = await guestBooking(
    new NextRequest('http://digistay.test/api/public/bookings', {
      method: 'POST',
      headers: { 'x-real-ip': `198.51.100.${++ip}` },
      body: JSON.stringify({
        propertyId,
        roomTypeId,
        guestName: 'Lê Thị Hoa',
        guestEmail: email,
        guestPhone: '0912345678',
        // Mon 7 → Wed 9 Dec 2026: two weekday nights.
        checkInDate: '2026-12-07',
        checkOutDate: '2026-12-09',
        numAdults: 2,
      }),
    })
  )
  return { status: res.status, body: await res.json() }
}

/** A published hotel with a 901,500 ₫ room, PayOS connected or not, taking `percent` online. */
async function hotel(opts: { connected: boolean; percent: number; deadlineMinutes?: number; totalRooms?: number }) {
  const tenant = await createTenant()
  await publishSite(tenant.property.id)
  if (opts.connected) await connectPayos(tenant.property.id, ACCOUNT, tenant.owner.id)
  await prisma.policy.create({
    data: { propertyId: tenant.property.id, onlineDepositPercent: opts.percent, depositDeadlineMinutes: opts.deadlineMinutes ?? 0 },
  })
  const room = await createRoomType(tenant.property.id, { weekdayPrice: 901_500, totalRooms: opts.totalRooms })
  return { ...tenant, room }
}

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000)
const depositOf = (bookingCode: string) => prisma.payment.findFirstOrThrow({ where: { booking: { bookingCode } } })

const depositEmails = (to: string) => prisma.emailOutbox.count({ where: { kind: 'deposit_received', toEmail: to } })

beforeAll(async () => {
  await fake.start()
  fake.deliver = async (url, body) => (await postWebhook(url.split('/').pop()!, body)).status
  process.env.PAYOS_BASE_URL = fake.url
  process.env.NEXTAUTH_URL = 'http://digistay.test'
})
beforeEach(async () => {
  await resetDatabase()
  store.data.clear()
  fake.links.clear()
  fake.addAccount(ACCOUNT)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(async () => {
  await fake.stop()
  process.env.PAYOS_BASE_URL = env.base
  process.env.NEXTAUTH_URL = env.url
  await prisma.$disconnect()
})

describe('a guest deposit', () => {
  it("is a PayOS link for the hotel's share; the webhook confirms the booking and emails the guest, once", async () => {
    const { property, room } = await hotel({ connected: true, percent: 30 })
    const { status, body } = await book(property.id, room.id)

    expect(status).toBe(200)
    expect(body.data).toMatchObject({
      status: 'PENDING',
      totalAmount: 1_803_000,
      // 30% = 540,900, rounded up to the next 1,000 (depositFor).
      deposit: { amount: 541_000, checkoutUrl: expect.stringContaining('pay.payos.vn') },
      depositUnavailable: false,
    })
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingCode: body.data.bookingCode } })
    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } })
    expect(payment).toMatchObject({ status: 'PENDING', amount: 541_000, paymentGateway: 'PAYOS', metadata: { guestDeposit: true, percent: 30 } })
    expect(fake.links.get(Number(payment.gatewayOrderCode))).toMatchObject({ amount: 541_000, status: 'PENDING' })
    expect(booking.status).toBe('PENDING') // the link alone confirms nothing

    const paid = await fake.pay(Number(payment.gatewayOrderCode))
    expect((await postWebhook(property.id, paid)).status).toBe(200)
    expect((await postWebhook(property.id, paid)).status).toBe(200) // PayOS resends

    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PARTIAL',
      depositAmount: 541_000,
    })
    expect(await depositEmails('khach@example.com')).toBe(1)
  })

  it('is not asked without a connected PayOS, nor at 0%', async () => {
    for (const opts of [{ connected: false, percent: 30 }, { connected: true, percent: 0 }]) {
      await resetDatabase()
      const { property, room } = await hotel(opts)
      const { status, body } = await book(property.id, room.id)
      expect(status).toBe(200)
      expect(body.data).toMatchObject({ deposit: null, depositUnavailable: false })
      expect(await prisma.payment.count()).toBe(0)
    }
  })

  it('PayOS refusing the link leaves the booking standing, and says the hotel will call', async () => {
    const { property, room } = await hotel({ connected: true, percent: 30 })
    fake.accounts.delete(ACCOUNT.clientId) // PayOS now refuses this account

    const { status, body } = await book(property.id, room.id)
    expect(status).toBe(200)
    expect(body.data).toMatchObject({ status: 'PENDING', deposit: null, depositUnavailable: true })
    expect(await prisma.booking.count({ where: { bookingCode: body.data.bookingCode } })).toBe(1)
    expect((await prisma.payment.findFirstOrThrow()).status).toBe('FAILED')
  })

  it('paid after the booking was cancelled: the money is recorded, nothing is confirmed, no one is emailed', async () => {
    const { property, room } = await hotel({ connected: true, percent: 30 })
    const { body } = await book(property.id, room.id)
    const booking = await prisma.booking.update({ where: { bookingCode: body.data.bookingCode }, data: { status: 'CANCELLED' } })
    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } })

    expect((await postWebhook(property.id, await fake.pay(Number(payment.gatewayOrderCode)))).status).toBe(200)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PAID')
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED')
    expect(await depositEmails('khach@example.com')).toBe(0)
  })

  it("a staff link paid on the same booking is not a deposit: no deposit email", async () => {
    const { property, room } = await hotel({ connected: false, percent: 0 })
    await connectPayos(property.id, ACCOUNT, (await prisma.workspace.findFirstOrThrow()).ownerId)
    const { body } = await book(property.id, room.id)
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingCode: body.data.bookingCode } })
    const payment = await prisma.payment.create({
      data: { bookingId: booking.id, propertyId: property.id, amount: 300_000, netAmount: 300_000, method: 'QR_VIETQR', paymentGateway: 'PAYOS', gatewayOrderCode: '1000000000000042' },
    })
    expect(await applyPayosPaid({ propertyId: property.id, orderCode: payment.gatewayOrderCode!, amount: 300_000, source: 'webhook' })).toBe('paid')
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
    expect(await depositEmails('khach@example.com')).toBe(0)
  })
})

describe("the hotel's deposit deadline", () => {
  it('unpaid at the deadline: the link and the booking are cancelled, the room is free again, the guest is told, once', async () => {
    const { property, room } = await hotel({ connected: true, percent: 30, deadlineMinutes: 60, totalRooms: 1 })
    const { body } = await book(property.id, room.id)
    const payment = await depositOf(body.data.bookingCode)
    // The link ends at the deadline.
    expect(Math.abs(payment.expiresAt!.getTime() - later(60).getTime())).toBeLessThan(60_000)
    expect((await book(property.id, room.id, 'khac@example.com')).status).toBe(409) // held meanwhile

    expect(await expireUnpaidDeposits(later(30))).toMatchObject({ checked: 0 })
    expect(await expireUnpaidDeposits(later(61))).toEqual({ checked: 1, cancelled: 1, paid: 0, errors: 0 })

    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingCode: body.data.bookingCode } })
    expect(booking.status).toBe('CANCELLED')
    expect((await depositOf(body.data.bookingCode)).status).toBe('CANCELLED')
    expect(fake.links.get(Number(payment.gatewayOrderCode))!.status).toBe('CANCELLED') // cannot be paid any more
    expect(await prisma.emailOutbox.count({ where: { kind: 'deposit_expired', toEmail: 'khach@example.com' } })).toBe(1)
    expect(await prisma.activityLog.count({ where: { action: 'CANCEL', entityId: booking.id } })).toBe(1)

    expect((await book(property.id, room.id, 'khac@example.com')).status).toBe(200) // free again
    // Running again: the first booking is not cancelled or emailed twice.
    await expireUnpaidDeposits(later(61))
    expect(await prisma.activityLog.count({ where: { action: 'CANCEL', entityId: booking.id } })).toBe(1)
    expect(await prisma.emailOutbox.count({ where: { kind: 'deposit_expired', toEmail: 'khach@example.com' } })).toBe(1)
  })

  it('the usual path: reconcile found the link EXPIRED at PayOS just before; the booking is still cancelled', async () => {
    const { property, room } = await hotel({ connected: true, percent: 30, deadlineMinutes: 60 })
    const { body } = await book(property.id, room.id)
    const payment = await depositOf(body.data.bookingCode)
    fake.links.get(Number(payment.gatewayOrderCode))!.status = 'EXPIRED' // PayOS ends the link at the deadline
    await reconcilePendingPayos()
    expect((await depositOf(body.data.bookingCode)).status).toBe('EXPIRED')

    expect(await expireUnpaidDeposits(later(61))).toEqual({ checked: 1, cancelled: 1, paid: 0, errors: 0 })
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: payment.bookingId } })).status).toBe('CANCELLED')
  })

  it('a booking with money recorded is never cancelled, whatever its status says', async () => {
    const { property, room } = await hotel({ connected: true, percent: 30, deadlineMinutes: 60 })
    const { body } = await book(property.id, room.id)
    const deposit = await depositOf(body.data.bookingCode)
    // Cash taken at the desk, the booking not moved on (old data, or a path that forgot).
    await prisma.payment.create({
      data: { bookingId: deposit.bookingId, propertyId: property.id, amount: 200_000, netAmount: 200_000, method: 'CASH', status: 'PAID' },
    })

    expect(await expireUnpaidDeposits(later(61))).toMatchObject({ cancelled: 0 })
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: deposit.bookingId } })).status).toBe('PENDING')
  })

  it('paid but the webhook was missed: PayOS is asked first, and the booking is confirmed, not cancelled', async () => {
    const { property, room } = await hotel({ connected: true, percent: 30, deadlineMinutes: 30 })
    const { body } = await book(property.id, room.id)
    await fake.pay(Number((await depositOf(body.data.bookingCode)).gatewayOrderCode)) // no webhook delivered

    expect(await expireUnpaidDeposits(later(31))).toMatchObject({ paid: 1, cancelled: 0 })
    expect(await prisma.booking.findUniqueOrThrow({ where: { bookingCode: body.data.bookingCode } })).toMatchObject({
      status: 'CONFIRMED',
      depositAmount: 541_000,
    })
    expect(await depositEmails('khach@example.com')).toBe(1)
  })

  it('left alone: no deadline, a link PayOS refused (the hotel will call), a booking the hotel confirmed', async () => {
    const none = await hotel({ connected: true, percent: 30 })
    const a = await book(none.property.id, none.room.id, 'a@example.com')

    const timed = await hotel({ connected: true, percent: 30, deadlineMinutes: 60 })
    const confirmed = await book(timed.property.id, timed.room.id, 'b@example.com')
    await prisma.booking.update({ where: { bookingCode: confirmed.body.data.bookingCode }, data: { status: 'CONFIRMED' } })
    fake.accounts.delete(ACCOUNT.clientId)
    const failed = await book(timed.property.id, timed.room.id, 'c@example.com')
    expect(failed.body.data.depositUnavailable).toBe(true)

    expect(await expireUnpaidDeposits(later(3 * 24 * 60))).toMatchObject({ checked: 0 })
    for (const { body } of [a, confirmed, failed]) {
      expect((await prisma.booking.findUniqueOrThrow({ where: { bookingCode: body.data.bookingCode } })).status).not.toBe('CANCELLED')
    }
  })
})

describe('what the hotel and the site see', () => {
  it("the site gets the deposit share and the hotel's cancellation terms, never PayOS details", async () => {
    const { property } = await hotel({ connected: true, percent: 25 })
    await prisma.policy.update({ where: { propertyId: property.id }, data: { cancellationHours: 48, cancellationPolicy: 'Hoàn cọc khi huỷ trước 48 giờ.' } })
    const res = await publicProperty(new NextRequest(`http://digistay.test/api/properties/public?subdomain=${property.subdomain}`))
    const { data } = await res.json()
    expect(data.onlineDeposit).toEqual({ percent: 25, deadlineMinutes: 0 })
    expect(data.policy).toEqual({ cancellationHours: 48, cancellationPolicy: 'Hoàn cọc khi huỷ trước 48 giờ.' })
    expect(data).not.toHaveProperty('payos')

    await prisma.propertyPayos.deleteMany({ where: { propertyId: property.id } })
    const after = await (await publicProperty(new NextRequest(`http://digistay.test/api/properties/public?subdomain=${property.subdomain}`))).json()
    expect(after.data.onlineDeposit).toBeNull()
  })

  it('the policy page sets 0–100 % and learns whether PayOS is connected', async () => {
    const { owner, property } = await hotel({ connected: false, percent: 0 })
    vi.mocked(auth).mockResolvedValue({ user: { id: owner.id, email: owner.email } } as never)
    const patch = (value: unknown) =>
      patchPolicy(new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ onlineDepositPercent: value }) }), {
        params: Promise.resolve({ id: property.id }),
      })

    expect((await patch(30)).status).toBe(200)
    expect((await patch(101)).status).toBe(400)
    expect((await patch(-1)).status).toBe(400)
    const deadline = (value: unknown) =>
      patchPolicy(new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ depositDeadlineMinutes: value }) }), {
        params: Promise.resolve({ id: property.id }),
      })
    for (const ok of [0, 30, 1440]) expect((await deadline(ok)).status).toBe(200)
    for (const bad of [10, 1441, -5]) expect((await deadline(bad)).status).toBe(400)
    const got = await (await getPolicy(new NextRequest('http://x'), { params: Promise.resolve({ id: property.id }) })).json()
    expect(got.data).toMatchObject({ onlineDepositPercent: 30, payosConnected: false })
  })
})
