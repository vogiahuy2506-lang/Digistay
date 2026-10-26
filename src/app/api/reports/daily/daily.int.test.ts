/**
 * The cash book (Sổ quỹ) counts money with the revenue report's rules, so
 * the two reports agree on any day: money in on the day it was paid, money
 * out on the day it was given back, for the amount given back (a partial
 * refund leaves its payment PROCESSING). Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { POST as cancelBooking } from '../../bookings/[id]/cancel/route'
import { GET as revenue } from '../revenue/route'
import { GET } from './route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

async function daily(propertyId: string, date: string) {
  const res = await GET(new NextRequest(`http://digistay.test/api/reports/daily?propertyId=${propertyId}&date=${date}`))
  return { status: res.status, body: await res.json() }
}

async function revenueOf(propertyId: string, date: string) {
  const res = await revenue(new NextRequest(`http://digistay.test/api/reports/revenue?propertyId=${propertyId}&from=${date}&to=${date}`))
  return (await res.json()).data.summary as { received: number; refunded: number; net: number }
}

function payment(
  booking: { id: string; propertyId: string },
  data: { amount: number; method?: PaymentMethod; paidAt: string | Date; status?: PaymentStatus; metadata?: Prisma.InputJsonValue }
) {
  return prisma.payment.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      amount: data.amount,
      netAmount: data.amount,
      method: data.method ?? 'CASH',
      status: data.status ?? 'PAID',
      paidAt: new Date(data.paidAt),
      metadata: data.metadata,
    },
  })
}

/** The Vietnam day (yyyy-mm-dd) of an instant. */
const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10)

type Tx = { type: string; category: string; amount: number; method: string | null }
const moves = (body: { data: { transactions: Tx[] } }) =>
  body.data.transactions.map((t) => [t.type, t.category, t.amount])

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/reports/daily', () => {
  it('counts a partial refund made through the cancel route as money out, like the revenue report', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const booking = await createBooking(property.id, { status: 'CONFIRMED', totalAmount: 4_140_000 })
    await prisma.booking.update({
      where: { id: booking.id },
      data: { checkInDate: new Date(Date.now() + 10 * 86_400_000), checkOutDate: new Date(Date.now() + 12 * 86_400_000) },
    })
    const other = await createBooking(property.id, { status: 'CONFIRMED', totalAmount: 4_800_000 })
    await payment(other, { amount: 4_800_000, paidAt: new Date() })
    const paid = await payment(booking, { amount: 2_070_000, paidAt: new Date() })

    // The hotel keeps half: 1,035,000 back to the guest.
    const cancel = await cancelBooking(
      new NextRequest(`http://digistay.test/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refund: { decision: 'custom', amount: 1_035_000, reason: 'Hoàn 50%' } }),
      }),
      { params: Promise.resolve({ id: booking.id }) }
    )
    expect(cancel.status).toBe(200)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paid.id } })).status).toBe('PROCESSING')

    const today = vnDay(new Date())
    const book = await daily(property.id, today)
    expect(book.status).toBe(200)
    expect(book.body.data.summary).toMatchObject({ totalIn: 6_870_000, totalOut: 1_035_000, balance: 5_835_000 })
    expect(book.body.data.methodBreakdown).toEqual([{ method: 'CASH', amount: 6_870_000, count: 2 }])
    expect(moves(book.body).sort()).toEqual(
      [
        ['IN', 'PAYMENT', 4_800_000],
        ['IN', 'PAYMENT', 2_070_000],
        ['OUT', 'REFUND', 1_035_000],
      ].sort()
    )

    // The same day in the revenue report.
    const report = await revenueOf(property.id, today)
    expect([book.body.data.summary.totalIn, book.body.data.summary.totalOut, book.body.data.summary.balance]).toEqual([
      report.received,
      report.refunded,
      report.net,
    ])
  })

  it('puts each movement on its own Vietnam day and lists check-ins as events without money', async () => {
    const { owner, property } = await createTenant()
    const other = await createTenant()
    signInAs(owner)
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })

    // 26/10 in Vietnam: 4.8M in cash, 2.07M by QR partly refunded the same
    // day, and a refund of a payment from the 25th.
    await payment(booking, { amount: 4_800_000, paidAt: '2026-10-26T07:00:00Z' })
    await payment(booking, {
      amount: 2_070_000,
      method: 'QR_VIETQR',
      paidAt: '2026-10-26T02:00:00Z',
      status: 'PROCESSING',
      metadata: { refundedAmount: 1_035_000, refundedAt: '2026-10-26T08:00:00.000Z' },
    })
    await payment(booking, {
      amount: 500_000,
      paidAt: '2026-10-25T16:30:00Z', // 23:30 on the 25th in Vietnam
      status: 'REFUNDED',
      metadata: { refundedAmount: 500_000, refundedAt: '2026-10-26T01:00:00.000Z' },
    })
    // Never paid, and another hotel's money: neither counts.
    await prisma.payment.create({
      data: { bookingId: booking.id, propertyId: property.id, amount: 999_000, netAmount: 999_000, method: 'CASH', status: 'PENDING' },
    })
    await payment(await createBooking(other.property.id), { amount: 777_000, paidAt: '2026-10-26T03:00:00Z' })
    const guest = await createBooking(property.id, { status: 'CHECKED_IN' })
    await prisma.booking.update({ where: { id: guest.id }, data: { actualCheckIn: new Date('2026-10-26T05:44:00Z') } })

    const day = await daily(property.id, '2026-10-26')
    expect(day.body.data.summary).toMatchObject({ totalIn: 6_870_000, totalOut: 1_535_000, balance: 5_335_000, checkIns: 1 })
    expect(moves(day.body)).toEqual([
      ['OUT', 'REFUND', 500_000], // 08:00
      ['IN', 'PAYMENT', 2_070_000], // 09:00
      ['EVENT', 'CHECK_IN', 0], // 12:44
      ['IN', 'PAYMENT', 4_800_000], // 14:00
      ['OUT', 'REFUND', 1_035_000], // 15:00
    ])
    expect(day.body.data.methodBreakdown).toEqual([
      { method: 'QR_VIETQR', amount: 2_070_000, count: 1 },
      { method: 'CASH', amount: 4_800_000, count: 1 },
    ])
    const report = await revenueOf(property.id, '2026-10-26')
    expect(report).toMatchObject({ received: 6_870_000, refunded: 1_535_000, net: 5_335_000 })

    const before = await daily(property.id, '2026-10-25')
    expect(before.body.data.summary).toMatchObject({ totalIn: 500_000, totalOut: 0, balance: 500_000 })
  })

  it('refuses a USER member and a bad date', async () => {
    const { property, member } = await createTenant({ memberRole: 'USER' })
    signInAs(member!)
    expect((await daily(property.id, '2026-10-26')).status).toBe(403)
    const { owner, property: mine } = await createTenant()
    signInAs(owner)
    expect((await daily(mine.id, 'garbage')).status).toBe(400)
  })
})
