/**
 * A hotel's money by permission (src/lib/auth/permissions.ts), against real
 * Postgres: a member with their own ticked set gets exactly what it says,
 * and a member limited to some properties sees nothing of the others.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { Permission } from '@/lib/auth/permissions'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  addMemberProperty,
  createBooking,
  createPendingPayment,
  createProperty,
  createTenant,
  resetDatabase,
} from '@/test/integration/fixtures'
import { GET as listPayments, POST as createPayment } from './route'
import { POST as confirmPayment } from './[id]/confirm/route'
import { GET as listInvoices, POST as createInvoice } from '../invoices/route'
import { GET as getInvoice, PUT as updateInvoice } from '../invoices/[id]/route'
import { GET as dailyReport } from '../reports/daily/route'
import { GET as revenueReport } from '../reports/revenue/route'
import { POST as createBankAccount } from '../bank-accounts/route'
import { PATCH as patchBankAccount } from '../bank-accounts/[id]/route'
import { PUT as connectPayos } from '../properties/[id]/payos/route'
import { PUT as saveEinvoice } from '../properties/[id]/einvoice/route'
import { PUT as setDepositMode } from '../properties/[id]/deposit-mode/route'
import { GET as workspaceStats } from '../workspaces/[id]/stats/route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

function req(path: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://digistay.test${path}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const json = async (res: Response) => ({ status: res.status, body: await res.json() })

/** A hotel whose second user is a member with exactly `permissions` ticked. */
const custom = (permissions: Permission[]) => createTenant({ memberRole: 'RECEPTIONIST', memberPermissions: permissions })

/** The front desk's set (the RECEPTIONIST preset) without `left`. */
const FRONT_DESK: Permission[] = [
  'bookings_view',
  'bookings_create',
  'bookings_edit',
  'bookings_cancel',
  'rooms_status',
  'payments_manage',
  'invoices_manage',
  'cashbook_view',
]
const without = (set: Permission[], ...left: Permission[]) => set.filter((p) => !left.includes(p))

function paidPayment(booking: { id: string; propertyId: string }, amount: number) {
  return prisma.payment.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      amount,
      netAmount: amount,
      method: 'CASH',
      status: 'PAID',
      paidAt: new Date(),
    },
  })
}

function draftInvoice(booking: { id: string; propertyId: string }) {
  return prisma.invoice.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      invoiceNumber: `INV-${booking.id}`,
      companyName: '',
      companyAddress: '',
      taxCode: '',
      customerName: 'Khách lẻ',
      customerEmail: 'khach-le@example.com',
      subtotal: 462_963,
      taxAmount: 37_037,
      totalAmount: 500_000,
      status: 'PENDING',
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

describe('payments_manage and revenue_view', () => {
  it('a member who works payments but does not see revenue gets the list without totals', async () => {
    const { property, member } = await custom(['bookings_view', 'payments_manage'])
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    await paidPayment(booking, 400_000)
    signInAs(member!)

    const res = await json(await listPayments(req(`/api/payments?propertyId=${property.id}`)))
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.stats).toBeNull()
  })

  it('a ticked revenue_view adds the totals', async () => {
    const { property, member } = await custom(['bookings_view', 'payments_manage', 'revenue_view'])
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    await paidPayment(booking, 400_000)
    signInAs(member!)

    const res = await json(await listPayments(req(`/api/payments?propertyId=${property.id}`)))
    expect(res.body.stats).toMatchObject({ paid: 400_000, paidCount: 1 })
    expect((await revenueReport(req(`/api/reports/revenue?propertyId=${property.id}`))).status).toBe(200)
  })

  it('without payments_manage: no list, 403 on recording a payment, nothing created', async () => {
    const { property, member } = await custom(without(FRONT_DESK, 'payments_manage'))
    const booking = await createBooking(property.id)
    signInAs(member!)

    expect((await json(await listPayments(req(`/api/payments?propertyId=${property.id}`)))).body.data).toEqual([])
    for (const method of ['CASH', 'BANK_TRANSFER']) {
      const res = await createPayment(req('/api/payments', 'POST', { bookingId: booking.id, method, amount: 100_000 }))
      expect(res.status).toBe(403)
    }
    expect(await prisma.payment.count()).toBe(0)
  })

  it('with payments_manage ticked: records cash and confirms a transfer', async () => {
    const { property, member } = await custom(['bookings_view', 'payments_manage'])
    const booking = await createBooking(property.id)
    const pending = await createPendingPayment(booking, 200_000)
    signInAs(member!)

    const cash = await createPayment(req('/api/payments', 'POST', { bookingId: booking.id, method: 'CASH', amount: 100_000 }))
    expect(cash.status).toBe(200)
    expect((await confirmPayment(req(`/api/payments/${pending.id}/confirm`, 'POST'), params(pending.id))).status).toBe(200)
    expect(await prisma.payment.count({ where: { status: 'PAID' } })).toBe(2)
  })

  it('without payments_manage: 403 on confirming a transfer, which stays PENDING', async () => {
    const { property, member } = await custom(without(FRONT_DESK, 'payments_manage'))
    const pending = await createPendingPayment(await createBooking(property.id), 200_000)
    signInAs(member!)

    const res = await json(await confirmPayment(req(`/api/payments/${pending.id}/confirm`, 'POST'), params(pending.id)))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Bạn không có quyền xác nhận thanh toán')
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('PENDING')
  })
})

describe('invoices_manage', () => {
  it('without it: no list, 403 on creating or editing; the invoice is still readable with bookings_view', async () => {
    const { property, member } = await custom(without(FRONT_DESK, 'invoices_manage'))
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    const draft = await draftInvoice(booking)
    signInAs(member!)

    expect((await json(await listInvoices(req(`/api/invoices?propertyId=${property.id}`)))).body.data).toEqual([])
    const body = { bookingId: booking.id, buyerType: 'consumer', customerName: 'Khách lẻ', customerEmail: 'khach-le@example.com', totalAmount: 100_000 }
    expect((await createInvoice(req('/api/invoices', 'POST', body))).status).toBe(403)
    expect((await updateInvoice(req(`/api/invoices/${draft.id}`, 'PUT', body), params(draft.id))).status).toBe(403)
    expect((await getInvoice(req(`/api/invoices/${draft.id}`), params(draft.id))).status).toBe(200)
  })
})

describe('a member limited to property A', () => {
  async function twoHotels() {
    const tenant = await createTenant({ memberRole: 'MANAGER', memberLimited: true })
    const a = tenant.property
    const b = await createProperty(tenant.workspace.id)
    await addMemberProperty(tenant.workspace.id, tenant.member!.id, a.id)
    const bookingA = await createBooking(a.id, { status: 'CONFIRMED', totalAmount: 1_000_000 })
    const bookingB = await createBooking(b.id, { status: 'CONFIRMED', totalAmount: 2_000_000 })
    await prisma.booking.update({ where: { id: bookingA.id }, data: { depositAmount: 300_000 } })
    await prisma.booking.update({ where: { id: bookingB.id }, data: { depositAmount: 700_000 } })
    return { ...tenant, a, b, bookingA, bookingB }
  }

  it("does not see B's payments or invoices, and gets 404 on B's payment and invoice", async () => {
    const { member, a, b, bookingA, bookingB } = await twoHotels()
    await paidPayment(bookingA, 300_000)
    await paidPayment(bookingB, 700_000)
    const pendingA = await createPendingPayment(bookingA, 100_000)
    const pendingB = await createPendingPayment(bookingB, 100_000)
    await draftInvoice(bookingA)
    const invoiceB = await draftInvoice(bookingB)
    signInAs(member!)

    const payments = await json(await listPayments(req('/api/payments')))
    expect(payments.body.data.map((p: { propertyId: string }) => p.propertyId)).toEqual([a.id, a.id])
    // MANAGER sees revenue, of A only.
    expect(payments.body.stats).toMatchObject({ paid: 300_000, paidCount: 1 })
    expect((await json(await listPayments(req(`/api/payments?propertyId=${b.id}`)))).body).toMatchObject({ data: [], stats: null })

    const invoices = await json(await listInvoices(req('/api/invoices')))
    expect(invoices.body.data.map((i: { propertyId: string }) => i.propertyId)).toEqual([a.id])

    const confirmB = await json(await confirmPayment(req(`/api/payments/${pendingB.id}/confirm`, 'POST'), params(pendingB.id)))
    expect(confirmB.status).toBe(404)
    expect(confirmB.body.error).toBe('Không tìm thấy thanh toán')
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pendingB.id } })).status).toBe('PENDING')
    expect((await confirmPayment(req(`/api/payments/${pendingA.id}/confirm`, 'POST'), params(pendingA.id))).status).toBe(200)

    expect((await getInvoice(req(`/api/invoices/${invoiceB.id}`), params(invoiceB.id))).status).toBe(404)
    const cash = await createPayment(req('/api/payments', 'POST', { bookingId: bookingB.id, method: 'CASH', amount: 100_000 }))
    expect(cash.status).toBe(403)
  })

  it("gets no report of B", async () => {
    const { member, a, b } = await twoHotels()
    signInAs(member!)

    expect((await dailyReport(req(`/api/reports/daily?propertyId=${a.id}&date=2026-10-27`))).status).toBe(200)
    expect((await dailyReport(req(`/api/reports/daily?propertyId=${b.id}&date=2026-10-27`))).status).toBe(403)
    expect((await revenueReport(req(`/api/reports/revenue?propertyId=${a.id}`))).status).toBe(200)
    expect((await revenueReport(req(`/api/reports/revenue?propertyId=${b.id}`))).status).toBe(403)
  })

  it('gets workspace stats over A only', async () => {
    const { member, workspace, a } = await twoHotels()
    signInAs(member!)

    const res = await json(await workspaceStats(req(`/api/workspaces/${workspace.id}/stats`), params(workspace.id)))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ totalProperties: 1, totalBookings: 1, monthlyRevenue: 300_000, totalRevenue: 1_000_000 })
    expect(res.body.data.byProperty.map((p: { id: string }) => p.id)).toEqual([a.id])
  })
})

describe('cashbook_view', () => {
  it('gates the daily report', async () => {
    const daily = (propertyId: string) => dailyReport(req(`/api/reports/daily?propertyId=${propertyId}&date=2026-10-27`))
    const refused = await custom(without(FRONT_DESK, 'cashbook_view'))
    signInAs(refused.member!)
    expect((await daily(refused.property.id)).status).toBe(403)

    const allowed = await custom(['cashbook_view'])
    signInAs(allowed.member!)
    expect((await daily(allowed.property.id)).status).toBe(200)
  })
})

describe('payment_settings', () => {
  const ALL_BUT_SETTINGS = without(
    [...FRONT_DESK, 'revenue_view', 'rooms_manage', 'room_types_manage', 'services_manage', 'property_edit', 'website_manage'],
    'payment_settings'
  )
  const account = { bankName: 'VCB', bankCode: 'VCB', accountNumber: '0123456789', accountHolder: 'KHACH SAN A' }

  it('without it: 403 on PayOS, Mắt Bão, the deposit mode and bank accounts; nothing saved', async () => {
    const { property, member } = await custom(ALL_BUT_SETTINGS)
    const existing = await prisma.bankAccount.create({ data: { propertyId: property.id, ...account } })
    signInAs(member!)

    expect((await connectPayos(req(`/api/properties/${property.id}/payos`, 'PUT', {}), params(property.id))).status).toBe(403)
    expect((await saveEinvoice(req(`/api/properties/${property.id}/einvoice`, 'PUT', {}), params(property.id))).status).toBe(403)
    expect((await setDepositMode(req(`/api/properties/${property.id}/deposit-mode`, 'PUT', { mode: 'MANUAL' }), params(property.id))).status).toBe(403)
    expect((await createBankAccount(req('/api/bank-accounts', 'POST', { propertyId: property.id, ...account }))).status).toBe(403)
    const patched = await patchBankAccount(req(`/api/bank-accounts/${existing.id}`, 'PATCH', { accountNumber: '999' }), params(existing.id))
    expect(patched.status).toBe(403)
    expect(await prisma.bankAccount.findMany({ select: { accountNumber: true } })).toEqual([{ accountNumber: '0123456789' }])
  })

  it('with it ticked: past the access check on each', async () => {
    const { property, member } = await custom(['payment_settings'])
    signInAs(member!)

    // Empty forms: the validation after the access check answers.
    expect((await connectPayos(req(`/api/properties/${property.id}/payos`, 'PUT', {}), params(property.id))).status).toBe(400)
    expect((await saveEinvoice(req(`/api/properties/${property.id}/einvoice`, 'PUT', {}), params(property.id))).status).toBe(400)
    expect((await setDepositMode(req(`/api/properties/${property.id}/deposit-mode`, 'PUT', {}), params(property.id))).status).toBe(400)
    expect((await createBankAccount(req('/api/bank-accounts', 'POST', { propertyId: property.id, ...account }))).status).toBe(200)
  })

  it('a member limited to another property is refused on this one', async () => {
    const { workspace, property, member } = await createTenant({ memberRole: 'ADMIN', memberLimited: true })
    const other = await createProperty(workspace.id)
    await addMemberProperty(workspace.id, member!.id, other.id)
    signInAs(member!)

    expect((await connectPayos(req(`/api/properties/${property.id}/payos`, 'PUT', {}), params(property.id))).status).toBe(403)
    expect((await createBankAccount(req('/api/bank-accounts', 'POST', { propertyId: property.id, ...account }))).status).toBe(403)
    expect((await createBankAccount(req('/api/bank-accounts', 'POST', { propertyId: other.id, ...account }))).status).toBe(200)
  })
})
