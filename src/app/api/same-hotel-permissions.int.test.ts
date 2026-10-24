/**
 * Who may do what inside one hotel, against real Postgres (audit
 * 2026-10-20): money and records that only staff should touch. Every
 * refused request must leave the rows as they were.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { WorkspaceRole } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST as extendBooking } from './bookings/[id]/extend/route'
import { POST as cancelBooking } from './bookings/[id]/cancel/route'
import { PATCH as patchBankAccount, DELETE as deleteBankAccount } from './bank-accounts/[id]/route'
import { GET as revenueReport } from './reports/revenue/route'
import { GET as dailyReport } from './reports/daily/route'
import { POST as createInvoice } from './invoices/route'
import { PUT as updateInvoice, DELETE as deleteInvoice } from './invoices/[id]/route'
import { POST as cancelInvoice } from './invoices/[id]/cancel/route'
import { createBooking, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
function signInAs(user: { id: string; email: string }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
}

function req(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const DAY = 24 * 60 * 60 * 1000

/** A hotel with a member of each role, and a guest account. */
async function hotel() {
  const tenant = await createTenant()
  const roles: WorkspaceRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER']
  const staff = {} as Record<WorkspaceRole, { id: string; email: string }>
  for (const role of roles) {
    staff[role] = await createUser()
    await prisma.workspaceMember.create({
      data: { workspaceId: tenant.workspace.id, userId: staff[role].id, role },
    })
  }
  const guest = await createUser()
  return { ...tenant, staff, guest }
}

/** The hotel cancels for free up to `hours` before check-in (no policy: no free cancellation). */
const freeCancellation = (propertyId: string, hours = 24) =>
  prisma.policy.create({ data: { propertyId, cancellationHours: hours } })

/** A confirmed booking of `guestEmail`, checking in 10 days from now. */
async function upcomingBooking(propertyId: string, guestEmail: string, totalAmount = 1_000_000) {
  const booking = await createBooking(propertyId, { guestEmail, totalAmount, status: 'CONFIRMED' })
  return prisma.booking.update({
    where: { id: booking.id },
    data: { checkInDate: new Date(Date.now() + 10 * DAY), checkOutDate: new Date(Date.now() + 12 * DAY) },
  })
}

function paidPayment(booking: { id: string; propertyId: string }, amount: number, metadata?: object) {
  return prisma.payment.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      amount,
      netAmount: amount,
      method: 'BANK_TRANSFER',
      status: 'PAID',
      paidAt: new Date(),
      ...(metadata && { metadata }),
    },
  })
}

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('POST /api/bookings/[id]/extend', () => {
  it('a guest cannot extend their booking, so cannot record a cash payment for it', async () => {
    const { property, guest } = await hotel()
    const booking = await upcomingBooking(property.id, guest.email)
    signInAs(guest)

    const res = await extendBooking(
      req(`/api/bookings/${booking.id}/extend`, 'POST', {
        newCheckOutDate: new Date(booking.checkOutDate.getTime() + 7 * DAY).toISOString(),
        addPayment: true,
      }),
      params(booking.id)
    )

    expect(res.status).toBe(403)
    expect(await prisma.payment.count()).toBe(0)
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(after.checkOutDate).toEqual(booking.checkOutDate)
  })

  it('a receptionist gets past the access check', async () => {
    const { property, staff, guest } = await hotel()
    const booking = await upcomingBooking(property.id, guest.email)
    signInAs(staff.RECEPTIONIST)

    const res = await extendBooking(
      req(`/api/bookings/${booking.id}/extend`, 'POST', {
        newCheckOutDate: new Date(booking.checkOutDate.getTime() + 2 * DAY).toISOString(),
      }),
      params(booking.id)
    )

    // The fixture booking has no rooms: the next check after access refuses it.
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Không tìm thấy thông tin hạng phòng')
  })
})

describe('POST /api/bookings/[id]/cancel', () => {
  const cancel = (bookingId: string, body: object = {}) =>
    cancelBooking(req(`/api/bookings/${bookingId}/cancel`, 'POST', body), params(bookingId))

  it('a guest cannot cancel, so cannot choose their own refund', async () => {
    const { property, guest } = await hotel()
    const booking = await upcomingBooking(property.id, guest.email)
    const payment = await paidPayment(booking, 1_000_000)
    signInAs(guest)

    const res = await cancel(booking.id, { refund: { decision: 'custom', amount: 999_999_999, reason: 'Tự chọn' } })

    // Not a member of the hotel's workspace: 404, so booking ids cannot be probed.
    expect(res.status).toBe(404)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PAID')
  })

  it('a full refund marks the booking REFUNDED and reports the amount refunded', async () => {
    const { property, staff, guest } = await hotel()
    await freeCancellation(property.id)
    const booking = await upcomingBooking(property.id, guest.email)
    const payment = await paidPayment(booking, 1_000_000)
    signInAs(staff.RECEPTIONIST)

    const res = await cancel(booking.id, { reason: 'Khách đổi lịch' })

    expect(res.status).toBe(200)
    expect((await res.json()).refundInfo).toEqual({ totalPaid: 1_000_000, refundAmount: 1_000_000 })
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect([after.status, after.paymentStatus]).toEqual(['CANCELLED', 'REFUNDED'])
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('REFUNDED')
  })

  it("a partial refund reports what was refunded and keeps the gateway's own metadata", async () => {
    const { property, staff, guest } = await hotel()
    await freeCancellation(property.id)
    const booking = await upcomingBooking(property.id, guest.email)
    const payment = await paidPayment(booking, 1_000_000, { payos: { orderCode: 4242 } })
    signInAs(staff.MANAGER)

    const res = await cancel(booking.id, { refund: { decision: 'custom', amount: 300_000, reason: 'Giữ phí đổi lịch' } })

    expect(res.status).toBe(200)
    expect((await res.json()).refundInfo).toEqual({ totalPaid: 1_000_000, refundAmount: 300_000 })
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(row.status).toBe('PROCESSING')
    expect(row.metadata).toMatchObject({ payos: { orderCode: 4242 }, refundedAmount: 300_000 })
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus).toBe('PARTIAL')
  })

  it('an unpaid booking keeps its payment status', async () => {
    const { property, staff, guest } = await hotel()
    const booking = await upcomingBooking(property.id, guest.email)
    signInAs(staff.RECEPTIONIST)

    const res = await cancel(booking.id)

    expect(res.status).toBe(200)
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect([after.status, after.paymentStatus]).toEqual(['CANCELLED', 'PENDING'])
  })

  it('two cancels at once refund once', async () => {
    const { property, staff, guest } = await hotel()
    await freeCancellation(property.id)
    const booking = await upcomingBooking(property.id, guest.email)
    await paidPayment(booking, 600_000)
    await paidPayment(booking, 400_000)
    signInAs(staff.RECEPTIONIST)

    const statuses = (await Promise.all([cancel(booking.id), cancel(booking.id)]))
      .map((res) => res.status)
      .sort()

    expect(statuses).toEqual([200, 400])
    expect(await prisma.activityLog.count({ where: { action: 'CANCEL', entityId: booking.id } })).toBe(1)
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: 'REFUNDED' } })).toBe(2)
  })
})

describe('PATCH/DELETE /api/bank-accounts/[id]', () => {
  it("a manager cannot change or remove where guests' transfers go; an admin can", async () => {
    const { property, staff } = await hotel()
    const account = await prisma.bankAccount.create({
      data: { propertyId: property.id, bankName: 'VCB', bankCode: 'VCB', accountNumber: '0123456789', accountHolder: 'KHACH SAN A' },
    })
    const accountNumber = async () => (await prisma.bankAccount.findUnique({ where: { id: account.id } }))?.accountNumber

    signInAs(staff.MANAGER)
    const patched = await patchBankAccount(
      req(`/api/bank-accounts/${account.id}`, 'PATCH', { accountNumber: '9999999999' }),
      params(account.id)
    )
    expect(patched.status).toBe(403)
    expect((await deleteBankAccount(req(`/api/bank-accounts/${account.id}`, 'DELETE'), params(account.id))).status).toBe(403)
    expect(await accountNumber()).toBe('0123456789')

    signInAs(staff.ADMIN)
    const byAdmin = await patchBankAccount(
      req(`/api/bank-accounts/${account.id}`, 'PATCH', { accountNumber: '1111111111' }),
      params(account.id)
    )
    expect(byAdmin.status).toBe(200)
    expect(await accountNumber()).toBe('1111111111')
  })
})

describe('reports', () => {
  it('revenue is for owners, admins and managers; the front-desk book also for receptionists', async () => {
    const { property, owner, staff } = await hotel()
    const revenue = async (user: { id: string; email: string }) => {
      signInAs(user)
      return (await revenueReport(req(`/api/reports/revenue?propertyId=${property.id}`))).status
    }
    const daily = async (user: { id: string; email: string }) => {
      signInAs(user)
      return (await dailyReport(req(`/api/reports/daily?propertyId=${property.id}&date=2026-10-20`))).status
    }

    expect([await revenue(owner), await revenue(staff.ADMIN), await revenue(staff.MANAGER)]).toEqual([200, 200, 200])
    expect([await revenue(staff.RECEPTIONIST), await revenue(staff.USER)]).toEqual([403, 403])
    expect([await daily(staff.RECEPTIONIST), await daily(staff.MANAGER)]).toEqual([200, 200])
    expect(await daily(staff.USER)).toBe(403)
  })
})

describe('invoice drafts', () => {
  const body = (bookingId: string) => ({
    bookingId,
    buyerType: 'consumer',
    customerName: 'Khách lẻ',
    customerEmail: 'khach-le@example.com',
    totalAmount: 500_000,
  })

  it('only staff create one; a guest or a USER member is refused', async () => {
    const { property, staff, guest } = await hotel()
    const booking = await upcomingBooking(property.id, guest.email)

    for (const user of [guest, staff.USER]) {
      signInAs(user)
      expect((await createInvoice(req('/api/invoices', 'POST', body(booking.id)))).status).toBe(403)
    }
    expect(await prisma.invoice.count()).toBe(0)

    // Staff get past the access check; this hotel has no Mắt Bão connection.
    signInAs(staff.RECEPTIONIST)
    const byStaff = await createInvoice(req('/api/invoices', 'POST', body(booking.id)))
    expect(byStaff.status).toBe(400)
    expect((await byStaff.json()).error).toContain('chưa kết nối hoá đơn điện tử')
  })

  it('a USER member cannot edit, delete or cancel a draft; a receptionist can', async () => {
    const { property, staff, guest } = await hotel()
    const booking = await upcomingBooking(property.id, guest.email)
    const draft = await prisma.invoice.create({
      data: {
        bookingId: booking.id,
        propertyId: property.id,
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
    const update = { ...body(booking.id), customerEmail: 'attacker@example.com' }

    signInAs(staff.USER)
    expect((await updateInvoice(req(`/api/invoices/${draft.id}`, 'PUT', update), params(draft.id))).status).toBe(403)
    expect((await deleteInvoice(req(`/api/invoices/${draft.id}`, 'DELETE'), params(draft.id))).status).toBe(403)
    expect((await cancelInvoice(req(`/api/invoices/${draft.id}/cancel`, 'POST', {}), params(draft.id))).status).toBe(403)
    const kept = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } })
    expect([kept.customerEmail, kept.status]).toEqual(['khach-le@example.com', 'PENDING'])

    signInAs(staff.RECEPTIONIST)
    expect((await deleteInvoice(req(`/api/invoices/${draft.id}`, 'DELETE'), params(draft.id))).status).toBe(200)
    expect(await prisma.invoice.count()).toBe(0)
  })
})
