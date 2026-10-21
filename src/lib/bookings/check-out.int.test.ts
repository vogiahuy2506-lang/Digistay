/**
 * Check-out against real Postgres: the late fee follows the hotel's
 * check-out time on the booked day and its tiers, the front desk applies,
 * changes or waives it (with a reason, logged), what is owed is recomputed
 * (a booking paid in full that owes a late fee is no longer PAID), a
 * discount survives, and two clicks check out once.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session.current), authOptions: {} }))

import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET as previewCheckOut, POST as checkOut } from '@/app/api/bookings/[id]/check-out/route'
import { PATCH as patchPolicy } from '@/app/api/properties/[id]/policy/route'

const signInAs = (user: { id: string; email: string }) => {
  session.current = { user: { id: user.id, email: user.email } }
}
const call = async (bookingId: string, body?: object) => {
  const res = await checkOut(
    new NextRequest('http://digistay.test/api/x', { method: 'POST', ...(body && { body: JSON.stringify(body) }) }),
    { params: Promise.resolve({ id: bookingId }) }
  )
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
    at('2026-12-09T08:00:00Z') // 15:00 VN: the default tiers say 30% of a night

    const { status, body } = await call(booking.id)
    expect(status).toBe(200)
    expect(body.lateFee).toBe(360_000)
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(after).toMatchObject({
      status: 'CHECKED_OUT',
      extraCharges: 360_000,
      totalAmount: 2_760_000,
      depositAmount: 2_400_000,
      paymentStatus: 'PARTIAL',
    })
  })

  it("uses the hotel's own check-out time", async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await prisma.policy.create({ data: { propertyId: property.id, checkOutTime: '14:00' } })
    const booking = await checkedIn(property.id)
    at('2026-12-09T06:00:00Z') // 13:00 VN: late by 12:00, on time by the hotel's 14:00

    expect((await call(booking.id)).body.lateFee).toBe(0)
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

describe("the front desk's decision", () => {
  const preview = async (bookingId: string) =>
    (await previewCheckOut(new NextRequest('http://digistay.test/api/x'), { params: Promise.resolve({ id: bookingId }) })).json()

  it('the dialog is shown the suggestion; the server charges its own number, not the browser\'s', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const booking = await checkedIn(property.id)
    at('2026-12-09T08:30:00Z') // 15:30 VN: 50%

    expect((await preview(booking.id)).data).toMatchObject({ suggestedFee: 600_000, percent: 50, hoursLate: 4, checkOutTime: '12:00' })
    const { body } = await call(booking.id, { lateFee: { decision: 'apply', amount: 1 } })
    expect(body).toMatchObject({ lateFee: 600_000, suggestedLateFee: 600_000 })
  })

  it('another amount or waiving needs a reason; both are logged with the suggestion', async () => {
    const { property, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(member!)
    at('2026-12-09T08:00:00Z') // 30% = 360,000 suggested

    const edited = await checkedIn(property.id)
    expect((await call(edited.id, { lateFee: { decision: 'edit', amount: 200_000 } })).status).toBe(400)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: edited.id } })).status).toBe('CHECKED_IN')
    const done = await call(edited.id, { lateFee: { decision: 'edit', amount: 200_000, reason: 'Khách quen, giảm còn 200k' } })
    expect(done.body.lateFee).toBe(200_000)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: edited.id } })).totalAmount).toBe(2_600_000)

    const waived = await checkedIn(property.id)
    expect((await call(waived.id, { lateFee: { decision: 'waive' } })).status).toBe(400)
    expect((await call(waived.id, { lateFee: { decision: 'waive', reason: 'Chuyến bay bị hoãn' } })).body.lateFee).toBe(0)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: waived.id } })).toMatchObject({ totalAmount: 2_400_000, paymentStatus: 'PAID' })

    const logs = await prisma.activityLog.findMany({ where: { entityId: { in: [edited.id, waived.id] } }, orderBy: { createdAt: 'asc' } })
    expect(logs.map((l) => l.changes)).toEqual([
      expect.objectContaining({ lateFee: 200_000, suggestedLateFee: 360_000, lateFeeDecision: 'edit', lateFeeReason: 'Khách quen, giảm còn 200k', lateFeePercent: 30 }),
      expect.objectContaining({ lateFee: 0, suggestedLateFee: 360_000, lateFeeDecision: 'waive', lateFeeReason: 'Chuyến bay bị hoãn' }),
    ])
    expect(logs.every((l) => l.userId === member!.id)).toBe(true)
  })

  it('a hotel that charges no late fee: nothing suggested, nothing charged', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await prisma.policy.create({ data: { propertyId: property.id, lateCheckoutTiers: [] } })
    const booking = await checkedIn(property.id)
    at('2026-12-09T11:30:00Z') // 18:30 VN

    expect((await preview(booking.id)).data.suggestedFee).toBe(0)
    expect((await call(booking.id)).body.lateFee).toBe(0)
  })

  it('the policy page saves tiers only when they make sense, and null goes back to the default', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const save = async (lateCheckoutTiers: unknown) =>
      (
        await patchPolicy(new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ lateCheckoutTiers }) }), {
          params: Promise.resolve({ id: property.id }),
        })
      ).status
    expect(await save([{ until: '14:00', percent: 20 }, { until: null, percent: 80 }])).toBe(200)
    expect(await save([])).toBe(200)
    expect(await save([{ until: '18:00', percent: 50 }, { until: '15:00', percent: 30 }, { until: null, percent: 100 }])).toBe(400)
    expect(await save([{ until: '15:00', percent: 30 }])).toBe(400)
    expect(await save(null)).toBe(200)
    expect((await prisma.policy.findUniqueOrThrow({ where: { propertyId: property.id } })).lateCheckoutTiers).toBeNull()
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
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).totalAmount).toBe(2_760_000)
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
