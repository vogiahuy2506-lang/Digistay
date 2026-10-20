/**
 * Check-out against real Postgres: the late fee follows the hotel's
 * check-out time on the booked day, what is owed is recomputed (a booking
 * paid in full that owes a late fee is no longer PAID), a discount
 * survives, and two clicks check out once.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session.current), authOptions: {} }))

import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { POST as checkOut } from '@/app/api/bookings/[id]/check-out/route'

const signInAs = (user: { id: string; email: string }) => {
  session.current = { user: { id: user.id, email: user.email } }
}
const call = async (bookingId: string) => {
  const res = await checkOut(new NextRequest('http://digistay.test/api/x', { method: 'POST' }), {
    params: Promise.resolve({ id: bookingId }),
  })
  return { status: res.status, body: await res.json() }
}
const at = (iso: string) => vi.setSystemTime(new Date(iso))

/** Checked in for 7 → 9 Dec 2026 (2 nights, 1.2M each), paid in full. */
async function checkedIn(propertyId: string, opts: { discount?: number } = {}) {
  const discount = opts.discount ?? 0
  const total = 2_400_000 - discount
  const booking = await prisma.booking.create({
    data: {
      bookingCode: `DS${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      propertyId,
      guestName: 'Lê Thị Hoa',
      guestEmail: 'hoa@example.com',
      guestPhone: '0912345678',
      checkInDate: new Date('2026-12-07T00:00:00Z'),
      checkOutDate: new Date('2026-12-09T00:00:00Z'),
      subtotal: 2_400_000,
      discount,
      totalAmount: total,
      depositAmount: total,
      paymentStatus: 'PAID',
      status: 'CHECKED_IN',
    },
  })
  await prisma.payment.create({
    data: { bookingId: booking.id, propertyId, amount: total, netAmount: total, method: 'CASH', status: 'PAID' },
  })
  return booking
}

beforeEach(async () => {
  await resetDatabase()
  session.current = null
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('late fee', () => {
  it("after the hotel's check-out time on the booked day: charged, and the booking owes it", async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const booking = await checkedIn(property.id)
    at('2026-12-09T08:00:00Z') // 15:00 VN, 3 hours after 12:00

    const { status, body } = await call(booking.id)
    expect(status).toBe(200)
    expect(body.lateFee).toBe(75_000)
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(after).toMatchObject({
      status: 'CHECKED_OUT',
      extraCharges: 75_000,
      totalAmount: 2_475_000,
      depositAmount: 2_400_000,
      paymentStatus: 'PARTIAL',
    })
  })

  it("uses the hotel's own check-out time", async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await prisma.policy.create({ data: { propertyId: property.id, checkOutTime: '14:00' } })
    const booking = await checkedIn(property.id)
    at('2026-12-09T08:00:00Z') // 15:00 VN, 1 hour after 14:00

    expect((await call(booking.id)).body.lateFee).toBe(25_000)
  })

  it('leaving a day early, in the evening, costs nothing and stays paid', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const booking = await checkedIn(property.id)
    at('2026-12-08T12:00:00Z') // 19:00 VN on the 8th

    expect((await call(booking.id)).body.lateFee).toBe(0)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      totalAmount: 2_400_000,
      paymentStatus: 'PAID',
    })
  })

  it("keeps the booking's discount (the total used to be rebuilt without it)", async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const booking = await checkedIn(property.id, { discount: 400_000 })
    at('2026-12-09T03:00:00Z') // 10:00 VN, on time

    expect((await call(booking.id)).status).toBe(200)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      totalAmount: 2_000_000,
      paymentStatus: 'PAID',
    })
  })
})

describe('once', () => {
  it('two check-outs at once: one succeeds, the fee is added once', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    at('2026-12-09T08:00:00Z')
    // Several rounds: a single one can run in sequence by chance.
    for (let round = 0; round < 3; round++) {
      const booking = await checkedIn(property.id)
      const results = await Promise.all([call(booking.id), call(booking.id)])
      expect(results.map((r) => r.status).sort()).toEqual([200, 400])
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).totalAmount).toBe(2_475_000)
      expect(await prisma.activityLog.count({ where: { entityId: booking.id } })).toBe(1)
    }
  })
})

describe('who', () => {
  it('outside the workspace: 404; a member without a front-desk role: 403', async () => {
    const { property, member } = await createTenant({ memberRole: 'USER' })
    const booking = await checkedIn(property.id)
    at('2026-12-09T03:00:00Z')

    signInAs(await createUser())
    expect((await call(booking.id)).status).toBe(404)
    signInAs(member!)
    expect((await call(booking.id)).status).toBe(403)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CHECKED_IN')
  })

  it('a receptionist checks out', async () => {
    const { property, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(member!)
    const booking = await checkedIn(property.id)
    at('2026-12-09T03:00:00Z')

    expect((await call(booking.id)).status).toBe(200)
  })
})
