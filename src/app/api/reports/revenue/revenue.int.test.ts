/**
 * The revenue report counts money when it moves, in Vietnam days: a
 * payment on the day it was paid, a refund on the day it was given back,
 * per payment method, and the invoices issued in the period. Against real
 * Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { GET } from './route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const report = async (propertyId: string, q: string) => {
  const res = await GET(new NextRequest(`http://digistay.test/api/reports/revenue?propertyId=${propertyId}&${q}`))
  return { status: res.status, body: await res.json() }
}

function payment(
  booking: { id: string; propertyId: string },
  data: { amount: number; method: PaymentMethod; paidAt: string; status?: PaymentStatus; metadata?: Prisma.InputJsonValue }
) {
  return prisma.payment.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      amount: data.amount,
      netAmount: data.amount,
      method: data.method,
      status: data.status ?? 'PAID',
      paidAt: new Date(data.paidAt),
      metadata: data.metadata,
    },
  })
}

let n = 0
function invoice(booking: { id: string; propertyId: string }, data: { status: 'PUBLISHED' | 'REPLACED' | 'DRAFT'; totalAmount: number; publishedAt: string | null }) {
  return prisma.invoice.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      invoiceNumber: `RV${String(++n).padStart(4, '0')}`,
      companyName: 'Công ty A',
      companyAddress: '1 Đường B',
      taxCode: '0101234567',
      customerName: 'Khách',
      customerEmail: 'k@example.com',
      subtotal: data.totalAmount,
      taxAmount: 0,
      totalAmount: data.totalAmount,
      status: data.status,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    },
  })
}

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/reports/revenue', () => {
  it('counts payments and refunds on their Vietnam day, by method, with the method filter', async () => {
    const { owner, property } = await createTenant()
    const other = await createTenant()
    signInAs(owner)
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })

    // 23:30 on 20/10 in Vietnam is still the 20th; 00:30 on the 21st is the 21st.
    await payment(booking, { amount: 300_000, method: 'CASH', paidAt: '2026-10-20T16:30:00Z' })
    await payment(booking, { amount: 500_000, method: 'QR_VIETQR', paidAt: '2026-10-20T17:30:00Z' })
    // Paid on the 21st, 200k of it given back on the 23rd (the cancel route's partial refund).
    await payment(booking, {
      amount: 400_000,
      method: 'CREDIT_CARD',
      paidAt: '2026-10-21T03:00:00Z',
      status: 'PROCESSING',
      metadata: { refundedAmount: 200_000, refundedAt: '2026-10-23T02:00:00.000Z' },
    })
    // Never paid, and another hotel's money: neither counts.
    await prisma.payment.create({
      data: { bookingId: booking.id, propertyId: property.id, amount: 999_000, netAmount: 999_000, method: 'CASH', status: 'PENDING' },
    })
    await payment(await createBooking(other.property.id), { amount: 777_000, method: 'CASH', paidAt: '2026-10-21T03:00:00Z' })

    const all = await report(property.id, 'from=2026-10-20&to=2026-10-23')
    expect(all.status).toBe(200)
    expect(all.body.data.summary).toMatchObject({ received: 1_200_000, receivedCount: 3, refunded: 200_000, refundedCount: 1, net: 1_000_000 })
    expect(all.body.data.series.map((s: { key: string; received: number; refunded: number }) => [s.key, s.received, s.refunded])).toEqual([
      ['2026-10-20', 300_000, 0],
      ['2026-10-21', 900_000, 0],
      ['2026-10-22', 0, 0],
      ['2026-10-23', 0, 200_000],
    ])
    const byMethod = Object.fromEntries(all.body.data.byMethod.map((m: { method: string; received: number }) => [m.method, m.received]))
    expect(byMethod).toEqual({ CASH: 300_000, BANK_TRANSFER: 0, QR: 500_000, CARD: 400_000, E_WALLET: 0 })

    const cards = await report(property.id, 'from=2026-10-20&to=2026-10-23&method=CARD')
    expect(cards.body.data.summary).toMatchObject({ received: 400_000, refunded: 200_000, net: 200_000 })
    // The method breakdown stays whole under a filter.
    expect(cards.body.data.byMethod.find((m: { method: string }) => m.method === 'CASH').received).toBe(300_000)

    // The refund on the 23rd is outside a period ending on the 22nd; the payment it came from is in.
    const before = await report(property.id, 'from=2026-10-20&to=2026-10-22')
    expect(before.body.data.summary).toMatchObject({ received: 1_200_000, refunded: 0 })

    const months = await report(property.id, 'from=2026-10-01&to=2026-11-30&groupBy=month')
    expect(months.body.data.series.map((s: { key: string; net: number }) => [s.key, s.net])).toEqual([
      ['2026-10', 1_000_000],
      ['2026-11', 0],
    ])

    const rows = await report(property.id, 'from=2026-10-20&to=2026-10-23&rows=1')
    expect(rows.body.data.rows.map((r: { kind: string; method: string; amount: number }) => [r.kind, r.method, r.amount])).toEqual([
      ['IN', 'CASH', 300_000],
      ['IN', 'QR_VIETQR', 500_000],
      ['IN', 'CREDIT_CARD', 400_000],
      ['REFUND', 'CREDIT_CARD', 200_000],
    ])
    expect(all.body.data.rows).toBeUndefined()
  })

  it('lists the invoices issued in the period and totals only the valid ones', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const booking = await createBooking(property.id, { status: 'CHECKED_OUT' })
    await invoice(booking, { status: 'REPLACED', totalAmount: 1_000_000, publishedAt: '2026-10-05T03:00:00Z' })
    await invoice(booking, { status: 'PUBLISHED', totalAmount: 1_000_000, publishedAt: '2026-10-06T03:00:00Z' })
    await invoice(booking, { status: 'PUBLISHED', totalAmount: -100_000, publishedAt: '2026-10-07T03:00:00Z' })
    await invoice(booking, { status: 'DRAFT', totalAmount: 500_000, publishedAt: null })
    await invoice(booking, { status: 'PUBLISHED', totalAmount: 2_000_000, publishedAt: '2026-09-30T03:00:00Z' })

    const res = await report(property.id, 'from=2026-10-01&to=2026-10-31')
    expect(res.body.data.summary).toMatchObject({ invoiced: 900_000, invoiceCount: 2 })
    expect(res.body.data.invoices.map((i: { status: string; totalAmount: number }) => [i.status, i.totalAmount])).toEqual([
      ['PUBLISHED', -100_000],
      ['PUBLISHED', 1_000_000],
      ['REPLACED', 1_000_000],
    ])
  })

  it('refuses bad dates, a reversed range, more than a year, and unknown filters', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    expect((await report(property.id, 'from=2026-01-01&to=2026-03-31')).status).toBe(200)
    expect((await report(property.id, 'from=garbage')).status).toBe(400)
    expect((await report(property.id, 'from=2026-05-01&to=2026-04-01')).status).toBe(400)
    const tooLong = await report(property.id, 'from=2020-01-01&to=2026-01-01')
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error).toContain('366')
    expect((await report(property.id, 'groupBy=week')).status).toBe(400)
    expect((await report(property.id, 'method=BITCOIN')).status).toBe(400)
  })
})
