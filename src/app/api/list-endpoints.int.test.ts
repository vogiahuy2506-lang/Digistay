/**
 * The invoice and payment lists page, filter and search in the database
 * (so a search covers every page), cap the page size, refuse bad
 * parameters with 400, and count their cards over the whole property;
 * the revenue report bounds its range. Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createPendingPayment, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { GET as listInvoices } from './invoices/route'
import { GET as listPayments } from './payments/route'
import { GET as revenue } from './reports/revenue/route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const get = async (handler: (r: NextRequest) => Promise<Response>, path: string) => {
  const res = await handler(new NextRequest(`http://digistay.test${path}`))
  return { status: res.status, body: await res.json() }
}

let n = 0
async function invoice(propertyId: string, data: { status?: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CANCELLED'; companyName?: string; totalAmount?: number; createdAt?: Date } = {}) {
  const booking = await createBooking(propertyId)
  return prisma.invoice.create({
    data: {
      bookingId: booking.id,
      propertyId,
      invoiceNumber: `INV${String(++n).padStart(4, '0')}`,
      companyName: data.companyName ?? '',
      companyAddress: '',
      taxCode: '',
      customerName: 'Khách',
      customerEmail: 'k@example.com',
      subtotal: 0,
      taxAmount: 0,
      totalAmount: data.totalAmount ?? 100_000,
      status: data.status ?? 'PENDING',
      ...(data.createdAt && { createdAt: data.createdAt }),
    },
  })
}

beforeEach(async () => {
  await resetDatabase()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/invoices', () => {
  it('pages newest first; the search and filters cover every page; cards count the property', async () => {
    const { owner, property } = await createTenant()
    const other = await createTenant()
    signInAs(owner)
    const base = Date.now() - 10 * 60 * 1000
    await invoice(property.id, { companyName: 'Công ty Sen', status: 'PUBLISHED', totalAmount: 300_000, createdAt: new Date(base) })
    for (let i = 1; i <= 4; i++) await invoice(property.id, { createdAt: new Date(base + i * 1000) })
    await invoice(property.id, { status: 'PUBLISHED', totalAmount: -50_000, createdAt: new Date(base + 5000) }) // a decrease
    await invoice(other.property.id, { companyName: 'Công ty Sen khác', status: 'PUBLISHED' })

    const page1 = await get(listInvoices, `/api/invoices?propertyId=${property.id}&limit=2`)
    expect(page1.status).toBe(200)
    expect(page1.body.data.map((i: { invoiceNumber: string }) => i.invoiceNumber)).toEqual(['INV0006', 'INV0005'])
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 6, totalPages: 3 })
    expect(page1.body.stats).toEqual({ total: 6, draft: 0, pending: 4, published: 2, issuedAmount: 250_000 })

    // The oldest invoice is on page 3; the search finds it, and only in this workspace.
    const found = await get(listInvoices, `/api/invoices?limit=2&q=${encodeURIComponent('sen')}`)
    expect(found.body.data.map((i: { invoiceNumber: string }) => i.invoiceNumber)).toEqual(['INV0001'])
    expect(found.body.stats.total).toBe(6) // cards ignore the search

    const published = await get(listInvoices, `/api/invoices?propertyId=${property.id}&status=PUBLISHED`)
    expect(published.body.pagination.total).toBe(2)
    expect((await get(listInvoices, `/api/invoices?limit=100000`)).body.pagination.limit).toBe(100)
  })

  it('refuses a bad status or date with 400, and reads days in Vietnam time', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    // 23:30 on 20/10 in Vietnam is 16:30 UTC the same day; 00:30 on 21/10 is 17:30 UTC on 20/10.
    const lateOn20th = await invoice(property.id, { createdAt: new Date('2026-10-20T16:30:00Z') })
    await invoice(property.id, { createdAt: new Date('2026-10-20T17:30:00Z') })
    expect((await get(listInvoices, `/api/invoices?status=SENT`)).status).toBe(400)
    expect((await get(listInvoices, `/api/invoices?startDate=20/10/2026`)).status).toBe(400)
    const day = await get(listInvoices, `/api/invoices?startDate=2026-10-20&endDate=2026-10-20`)
    expect(day.body.data.map((i: { id: string }) => i.id)).toEqual([lateOn20th.id])
  })
})

describe('GET /api/payments', () => {
  it('pages, filters by status and method, searches by booking code, sums the cards', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const target = await createBooking(property.id)
    const paid = await createPendingPayment(target, 400_000)
    await prisma.payment.update({ where: { id: paid.id }, data: { status: 'PAID', method: 'CASH' } })
    for (const [status, amount] of [['PENDING', 100_000], ['FAILED', 70_000], ['EXPIRED', 30_000]] as const) {
      const p = await createPendingPayment(await createBooking(property.id), amount)
      await prisma.payment.update({ where: { id: p.id }, data: { status } })
    }

    const all = await get(listPayments, `/api/payments?propertyId=${property.id}&limit=3`)
    expect(all.status).toBe(200)
    expect(all.body.data).toHaveLength(3)
    expect(all.body.pagination).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 })
    expect(all.body.stats).toEqual({
      total: 600_000,
      count: 4,
      pending: 100_000,
      paid: 400_000,
      failed: 100_000,
      pendingCount: 1,
      paidCount: 1,
      failedCount: 2,
    })

    const search = await get(listPayments, `/api/payments?propertyId=${property.id}&q=${target.bookingCode.toLowerCase()}`)
    expect(search.body.data.map((p: { id: string }) => p.id)).toEqual([paid.id])
    expect((await get(listPayments, `/api/payments?method=CASH`)).body.pagination.total).toBe(1)
    expect((await get(listPayments, `/api/payments?status=PAID`)).body.pagination.total).toBe(1)
    expect((await get(listPayments, `/api/payments?method=BITCOIN`)).status).toBe(400)
    expect((await get(listPayments, `/api/payments?status=paid`)).status).toBe(400)
  })
})

describe('GET /api/reports/revenue', () => {
  it('refuses unreadable dates, a reversed range and more than a year', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const r = (q: string) => get(revenue, `/api/reports/revenue?propertyId=${property.id}&${q}`)
    expect((await r('startDate=2026-01-01&endDate=2026-03-31')).status).toBe(200)
    expect((await r('startDate=garbage')).status).toBe(400)
    expect((await r('startDate=2026-05-01&endDate=2026-04-01')).status).toBe(400)
    const tooLong = await r('startDate=2020-01-01&endDate=2026-01-01')
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error).toContain('366')
  })
})
