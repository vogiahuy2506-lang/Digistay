/**
 * Who sees a hotel's money (QA F04): staff work the payments, but revenue
 * and money totals are for the owner, ADMIN and MANAGER only; a USER member
 * sees neither. Bank accounts are saved as banks print them (QA F02/F27).
 * Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { WorkspaceRole } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET as listPayments } from './route'
import { GET as listInvoices } from '../invoices/route'
import { GET as workspaceStats } from '../workspaces/[id]/stats/route'
import { POST as createBankAccount } from '../bank-accounts/route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const get = async (handler: (r: NextRequest) => Promise<Response>, path: string) => {
  const res = await handler(new NextRequest(`http://digistay.test${path}`))
  return { status: res.status, body: await res.json() }
}

/** A hotel with a member of each role, one paid payment and one published invoice. */
async function hotel() {
  const tenant = await createTenant()
  const staff = {} as Record<WorkspaceRole, { id: string; email: string }>
  for (const role of ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'] as WorkspaceRole[]) {
    staff[role] = await createUser()
    await prisma.workspaceMember.create({ data: { workspaceId: tenant.workspace.id, userId: staff[role].id, role } })
  }
  const booking = await createBooking(tenant.property.id, { status: 'CONFIRMED', totalAmount: 1_000_000 })
  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      propertyId: tenant.property.id,
      amount: 400_000,
      netAmount: 400_000,
      method: 'CASH',
      status: 'PAID',
      paidAt: new Date(),
    },
  })
  await prisma.booking.update({ where: { id: booking.id }, data: { depositAmount: 400_000, paymentStatus: 'PARTIAL' } })
  await prisma.invoice.create({
    data: {
      bookingId: booking.id,
      propertyId: tenant.property.id,
      invoiceNumber: 'INV0001',
      companyName: 'Công ty A',
      companyAddress: '1 Đường B',
      taxCode: '0101234567',
      customerName: 'Khách',
      customerEmail: 'k@example.com',
      subtotal: 1_000_000,
      taxAmount: 0,
      totalAmount: 1_000_000,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  })
  return { ...tenant, staff }
}

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/payments', () => {
  it('gives the list to staff, the totals to the owner and managers only, nothing to a USER member', async () => {
    const { owner, property, staff } = await hotel()
    const path = `/api/payments?propertyId=${property.id}`

    for (const user of [owner, staff.ADMIN, staff.MANAGER]) {
      signInAs(user)
      const res = await get(listPayments, path)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.stats).toMatchObject({ paid: 400_000, paidCount: 1 })
    }

    signInAs(staff.RECEPTIONIST)
    const desk = await get(listPayments, path)
    expect(desk.status).toBe(200)
    expect(desk.body.data).toHaveLength(1)
    expect(desk.body.stats).toBeNull()

    signInAs(staff.USER)
    const user = await get(listPayments, path)
    expect(user.body.data).toEqual([])
    expect(user.body.stats).toBeNull()
  })
})

describe('GET /api/invoices', () => {
  it('gives the amount issued to the owner and managers only', async () => {
    const { property, staff } = await hotel()
    const path = `/api/invoices?propertyId=${property.id}`

    signInAs(staff.MANAGER)
    expect((await get(listInvoices, path)).body.stats).toMatchObject({ published: 1, issuedAmount: 1_000_000 })

    for (const user of [staff.RECEPTIONIST, staff.USER]) {
      signInAs(user)
      const res = await get(listInvoices, path)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.stats).toMatchObject({ published: 1, issuedAmount: null })
    }
  })
})

describe('GET /api/workspaces/[id]/stats', () => {
  it('leaves revenue out for a receptionist and a USER member', async () => {
    const { workspace, staff } = await hotel()
    const stats = async (user: { id: string; email: string }) => {
      signInAs(user)
      const res = await workspaceStats(new NextRequest(`http://digistay.test/api/workspaces/${workspace.id}/stats`), {
        params: Promise.resolve({ id: workspace.id }),
      })
      return (await res.json()).data
    }

    const manager = await stats(staff.MANAGER)
    expect(manager).toMatchObject({ monthlyRevenue: 400_000, totalRevenue: 1_000_000 })
    expect(manager.byProperty[0].revenue).toBe(400_000)

    for (const user of [staff.RECEPTIONIST, staff.USER]) {
      const data = await stats(user)
      expect(data.totalBookings).toBe(1)
      expect(data).not.toHaveProperty('monthlyRevenue')
      expect(data).not.toHaveProperty('totalRevenue')
      expect(data.byProperty[0]).not.toHaveProperty('revenue')
    }
  })
})

describe('POST /api/bank-accounts', () => {
  const post = (body: object) =>
    createBankAccount(
      new NextRequest('http://digistay.test/api/bank-accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    )

  it('saves the holder as banks print it and the bank by its VietQR code; refuses an unknown bank', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)

    const res = await post({
      propertyId: property.id,
      bankName: 'VietinBank',
      bankCode: 'VTB',
      accountNumber: '1234 5678 90',
      accountHolder: 'công ty khách sạn Đà Lạt',
    })
    expect(res.status).toBe(200)
    const saved = await prisma.bankAccount.findFirstOrThrow({ where: { propertyId: property.id } })
    expect([saved.bankCode, saved.accountNumber, saved.accountHolder]).toEqual(['ICB', '1234567890', 'CONG TY KHACH SAN DA LAT'])

    const unknown = await post({ propertyId: property.id, bankName: 'Ngân hàng X', bankCode: 'XYZ', accountNumber: '1234567890', accountHolder: 'A B' })
    expect(unknown.status).toBe(400)
    expect((await unknown.json()).error).toBe('Ngân hàng không hỗ trợ VietQR')
  })
})
