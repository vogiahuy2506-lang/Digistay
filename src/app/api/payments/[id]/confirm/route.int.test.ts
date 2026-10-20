/**
 * POST /api/payments/[id]/confirm against real Postgres: the conditional
 * update, the transaction and the booking row lock are exercised for real,
 * including concurrent requests.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST } from './route'
import {
  createBooking,
  createPendingPayment,
  createTenant,
  resetDatabase,
} from '@/test/integration/fixtures'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>

function signInAs(user: { id: string; email: string }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
}

function confirm(paymentId: string) {
  return POST(
    new NextRequest(`http://localhost/api/payments/${paymentId}/confirm`, { method: 'POST' }),
    { params: Promise.resolve({ id: paymentId }) }
  )
}

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('POST /api/payments/[id]/confirm (Postgres)', () => {
  it('two simultaneous confirms of the same payment: exactly one succeeds, logged once', async () => {
    const { property, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    const booking = await createBooking(property.id, { totalAmount: 500_000 })
    const payment = await createPendingPayment(booking, 500_000)
    signInAs(member!)

    const statuses = (await Promise.all([confirm(payment.id), confirm(payment.id)]))
      .map((r) => r.status)
      .sort()

    expect(statuses).toEqual([200, 409])
    expect(
      await prisma.activityLog.count({ where: { entityId: payment.id, action: 'CONFIRM_PAYMENT' } })
    ).toBe(1)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      depositAmount: 500_000,
    })
  })

  it('two payments of one booking confirmed at the same time: depositAmount includes both', async () => {
    const { property, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(member!)

    // Several rounds, so a missing row lock shows up even if one round happens to serialize.
    for (let round = 0; round < 5; round++) {
      const booking = await createBooking(property.id, { totalAmount: 1_000_000 })
      const p1 = await createPendingPayment(booking, 400_000)
      const p2 = await createPendingPayment(booking, 600_000)

      const res = await Promise.all([confirm(p1.id), confirm(p2.id)])

      expect(res.map((r) => r.status)).toEqual([200, 200])
      expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
        depositAmount: 1_000_000,
        paymentStatus: 'PAID',
      })
    }
  })

  it('staff of another hotel get 404 and the payment stays PENDING', async () => {
    const hotelA = await createTenant({ memberRole: 'RECEPTIONIST' })
    const hotelB = await createTenant({ memberRole: 'RECEPTIONIST' })
    const booking = await createBooking(hotelA.property.id)
    const payment = await createPendingPayment(booking, 300_000)
    signInAs(hotelB.member!)

    const res = await confirm(payment.id)

    expect(res.status).toBe(404)
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: 'PENDING',
      paidAt: null,
    })
  })
})
