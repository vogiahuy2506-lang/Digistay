/**
 * /api/payments
 * - GET must always be scoped to the caller's properties (payments_manage).
 * - POST: guests cannot create CASH (CASH confirms money on creation); the
 *   amount is checked against what is still owed, inside a transaction
 *   with the booking row locked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))
// The plan lock (src/lib/billing) has its own integration test: never locked here.
vi.mock('@/lib/billing/guard', () => ({ lockedResponseForProperty: vi.fn(async () => null) }))

const tx = {
  $queryRaw: vi.fn(),
  booking: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  payment: { aggregate: vi.fn(), create: vi.fn() },
  activityLog: { create: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    // GET pages and counts in the database (src/lib/api/list-params.ts).
    payment: { findMany: vi.fn(), count: vi.fn(async () => 0), groupBy: vi.fn(async () => []) },
    // money-access.ts: may the caller see the totals?
    property: { count: vi.fn(async () => 1) },
    // access.ts: the caller's membership of the booking's workspace.
    workspace: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { accessibleProperties } from '@/lib/auth/access'
import { GET, POST } from './route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  payment: { findMany: ReturnType<typeof vi.fn>; groupBy: ReturnType<typeof vi.fn> }
  property: { count: ReturnType<typeof vi.fn> }
  workspace: { findUnique: ReturnType<typeof vi.fn> }
  booking: { findUnique: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

/** Who may work payments (payments_manage) lists them; a USER member does not. */
const accessFilter = (userId: string) => ({
  property: accessibleProperties(userId, 'payments_manage'),
})

function get(query = '') {
  return GET(new NextRequest(`http://localhost/api/payments${query}`))
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

/** Booking bk-1 in ws-1 (owner: owner-1), guest guest@example.com; the caller a member with `memberRole` (null: none). */
function bookingSeenBy(memberRole: string | null) {
  mockPrisma.workspace.findUnique.mockResolvedValue({
    ownerId: 'owner-1',
    members: memberRole
      ? [{ role: memberRole, permissions: [], customPermissions: false, allProperties: true, properties: [] }]
      : [],
  })
  return {
    id: 'bk-1',
    bookingCode: 'DSABC123',
    propertyId: 'prop-1',
    status: 'PENDING',
    guestEmail: 'guest@example.com',
    property: {
      id: 'prop-1',
      name: 'Hotel A',
      city: 'Da Lat',
      workspaceId: 'ws-1',
      bankAccounts: [],
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.payment.findMany.mockResolvedValue([])
  mockPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
  tx.booking.findUniqueOrThrow.mockResolvedValue({ status: 'PENDING', totalAmount: 1000000 })
  tx.payment.aggregate.mockResolvedValue({ _sum: { amount: null } })
  tx.payment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'pay-new',
    ...data,
  }))
})

describe('GET /api/payments', () => {
  it('returns 401 when signed out, without querying the DB', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await get()
    expect(res.status).toBe(401)
    expect(mockPrisma.payment.findMany).not.toHaveBeenCalled()
  })

  it('without params, lists only payments in the caller\'s workspaces', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    const res = await get()
    expect(res.status).toBe(200)
    expect(mockPrisma.payment.findMany.mock.calls[0][0].where).toEqual(accessFilter('user-1'))
  })

  it('adds propertyId and bookingId on top of the access filter instead of replacing it', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    await get('?propertyId=prop-other&bookingId=bk-1')
    expect(mockPrisma.payment.findMany.mock.calls[0][0].where).toEqual({
      ...accessFilter('user-1'),
      propertyId: 'prop-other',
      bookingId: 'bk-1',
    })
  })

  it('sums the cards over the properties whose revenue the caller sees only', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    const res = await get('?propertyId=prop-1')
    expect(mockPrisma.payment.groupBy.mock.calls[0][0].where).toEqual({
      property: accessibleProperties('user-1', 'revenue_view'),
      propertyId: 'prop-1',
    })
    expect(mockPrisma.property.count.mock.calls[0][0].where).toEqual({
      AND: [accessibleProperties('user-1', 'revenue_view'), { id: 'prop-1' }],
    })
    expect((await res.json()).stats).toMatchObject({ total: 0, paid: 0 })
  })

  it('gives no totals to a caller who may not see them (a receptionist)', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    mockPrisma.property.count.mockResolvedValueOnce(0)
    const res = await get('?propertyId=prop-1')
    expect(res.status).toBe(200)
    expect((await res.json()).stats).toBeNull()
  })
})

describe('POST /api/payments — access', () => {
  it('returns 401 when signed out', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 1000000 })
    expect(res.status).toBe(401)
    expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled()
  })

  it('guest creating CASH → 403, nothing created, booking not confirmed', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'guest-user', email: 'guest@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy(null))
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 1000000 })
    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('member with USER role creating CASH → 403', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy('USER'))
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 1000000 })
    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('member who does not work payments (USER) creating a bank transfer → 403', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy('USER'))
    const res = await post({ bookingId: 'bk-1', method: 'BANK_TRANSFER', amount: 500000 })
    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('outsider (neither member nor guest) → 403', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'stranger', email: 's@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy(null))
    const res = await post({ bookingId: 'bk-1', method: 'BANK_TRANSFER', amount: 500000 })
    expect(res.status).toBe(403)
  })

  it('guest can still create a bank transfer (PENDING); booking status untouched', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'guest-user', email: 'guest@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy(null))
    const res = await post({ bookingId: 'bk-1', method: 'BANK_TRANSFER', amount: 500000 })
    expect(res.status).toBe(200)
    expect(tx.payment.create.mock.calls[0][0].data.status).toBe('PENDING')
    expect(tx.booking.update).not.toHaveBeenCalled()
  })

  it.each(['RECEPTIONIST', 'MANAGER', 'ADMIN'])('%s can create CASH', async (role) => {
    mockAuth.mockResolvedValue({ user: { id: 'staff-1', email: 'staff@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy(role))
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 1000000 })
    expect(res.status).toBe(200)
  })

  it('workspace owner can create CASH', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy(null))
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 1000000 })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/payments — amount check', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'staff-1', email: 'staff@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy('RECEPTIONIST'))
  })

  it('locks the booking before checking, all inside one transaction', async () => {
    await post({ bookingId: 'bk-1', method: 'CASH', amount: 1000000 })
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    const [sql, bookingId] = tx.$queryRaw.mock.calls[0]
    expect(sql.join('?')).toContain('FOR UPDATE')
    expect(bookingId).toBe('bk-1')
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.payment.aggregate.mock.invocationCallOrder[0]
    )
    expect(tx.payment.aggregate).toHaveBeenCalledWith({
      where: { bookingId: 'bk-1', status: 'PAID' },
      _sum: { amount: true },
    })
  })

  it('CASH for exactly the remaining amount → PAID, booking PENDING → CONFIRMED, logged with amount', async () => {
    // Paid before: 400k (remaining check); after this payment: 1M (sync).
    tx.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 400000 } })
      .mockResolvedValueOnce({ _sum: { amount: 1000000 } })
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 600000 })
    expect(res.status).toBe(200)
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ status: 'PAID', amount: 600000 })
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: { depositAmount: 1000000, paymentStatus: 'PAID', status: 'CONFIRMED' },
    })
    expect(tx.activityLog.create.mock.calls[0][0].data).toMatchObject({
      userId: 'staff-1',
      entityId: 'pay-new',
      metadata: { method: 'CASH', amount: 600000 },
    })
  })

  it('CASH above the remaining amount → 400, nothing created, booking untouched', async () => {
    tx.payment.aggregate.mockResolvedValue({ _sum: { amount: 400000 } })
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 600001 })
    expect(res.status).toBe(400)
    expect(tx.payment.create).not.toHaveBeenCalled()
    expect(tx.booking.update).not.toHaveBeenCalled()
  })

  it('fully paid booking → 400', async () => {
    tx.payment.aggregate.mockResolvedValue({ _sum: { amount: 1000000 } })
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 1000 })
    expect(res.status).toBe(400)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it('also applies to a guest bank transfer', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'guest-user', email: 'guest@example.com' } })
    mockPrisma.booking.findUnique.mockResolvedValue(bookingSeenBy(null))
    const res = await post({ bookingId: 'bk-1', method: 'BANK_TRANSFER', amount: 1000001 })
    expect(res.status).toBe(400)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it.each(['CANCELLED', 'NO_SHOW'])('%s booking → 409, nothing created', async (status) => {
    tx.booking.findUniqueOrThrow.mockResolvedValue({ status, totalAmount: 1000000 })
    const res = await post({ bookingId: 'bk-1', method: 'CASH', amount: 500000 })
    expect(res.status).toBe(409)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})
