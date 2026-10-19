/**
 * /api/payments against real Postgres: CASH access, the amount check under
 * concurrency, and tenant scoping of GET with the real relation filters.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GET, POST } from './route'
import {
  createBooking,
  createPendingPayment,
  createTenant,
  createUser,
  resetDatabase,
} from '@/test/integration/fixtures'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>

function signInAs(user: { id: string; email: string }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

async function getIds(query = '') {
  const res = await GET(new NextRequest(`http://localhost/api/payments${query}`))
  const body = await res.json()
  return (body.data as { id: string }[]).map((p) => p.id).sort()
}

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('POST /api/payments (Postgres)', () => {
  it('concurrent CASH requests cannot collect more than what is owed', async () => {
    const { property, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(member!)

    // Several rounds: a single round occasionally serializes by timing and
    // would pass even without the booking row lock.
    for (let round = 0; round < 5; round++) {
      const booking = await createBooking(property.id, { totalAmount: 1_000_000 })

      const statuses = (
        await Promise.all(
          [1, 2, 3].map(() => post({ bookingId: booking.id, method: 'CASH', amount: 600_000 }))
        )
      )
        .map((r) => r.status)
        .sort()

      expect(statuses).toEqual([200, 400, 400])
      const paid = await prisma.payment.aggregate({
        where: { bookingId: booking.id, status: 'PAID' },
        _sum: { amount: true },
      })
      expect(paid._sum.amount).toBe(600_000)
    }
  })

  it('a guest cannot confirm their own booking with a CASH payment', async () => {
    const { property } = await createTenant()
    const guest = await createUser()
    const booking = await createBooking(property.id, { guestEmail: guest.email })
    signInAs(guest)

    const res = await post({ bookingId: booking.id, method: 'CASH', amount: 1_000_000 })

    expect(res.status).toBe(403)
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(0)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: 'PENDING',
      paymentStatus: 'PENDING',
    })
  })
})

describe('GET /api/payments (Postgres)', () => {
  it('only returns payments of the caller\'s own hotels', async () => {
    const hotelA = await createTenant({ memberRole: 'RECEPTIONIST' })
    const hotelB = await createTenant({ memberRole: 'RECEPTIONIST' })
    const payA = await createPendingPayment(await createBooking(hotelA.property.id), 100_000)
    await createPendingPayment(await createBooking(hotelB.property.id), 200_000)
    signInAs(hotelA.member!)

    expect(await getIds()).toEqual([payA.id])
    expect(await getIds(`?propertyId=${hotelB.property.id}`)).toEqual([])
  })
})
