/**
 * POST /api/payments/[id]/confirm — staff confirm a bank transfer was received.
 *
 * Uses the real rbac helpers (requireSession/getWorkspaceRole) and mocks only
 * NextAuth and Prisma. $transaction runs its callback against a fake `tx`.
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
  payment: { updateMany: vi.fn(), aggregate: vi.fn() },
  booking: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  activityLog: { create: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    payment: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST } from './route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  payment: { findUnique: ReturnType<typeof vi.fn> }
  workspace: { findUnique: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

const PAYMENT = {
  id: 'pay-1',
  bookingId: 'bk-1',
  propertyId: 'prop-1',
  amount: 500000,
  property: { workspaceId: 'ws-1' },
}

function confirm(id = 'pay-1') {
  return POST(
    new NextRequest(`http://localhost/api/payments/${id}/confirm`, {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'vitest' },
    }),
    { params: Promise.resolve({ id }) }
  )
}

/** Signs in `userId` as a member of ws-1 with `role` (null = not a member). */
function signInAs(userId: string, role: string | null) {
  mockAuth.mockResolvedValue({ user: { id: userId } })
  mockPrisma.workspace.findUnique.mockResolvedValue({
    ownerId: 'owner-1',
    members: role ? [{ role }] : [],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.payment.findUnique.mockResolvedValue(PAYMENT)
  mockPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
  tx.payment.updateMany.mockResolvedValue({ count: 1 })
  tx.payment.aggregate.mockResolvedValue({ _sum: { amount: 500000 } })
  tx.booking.findUniqueOrThrow.mockResolvedValue({ status: 'PENDING', totalAmount: 500000 })
})

describe('access', () => {
  it('returns 401 when signed out', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await confirm()
    expect(res.status).toBe(401)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 404 when the payment does not exist', async () => {
    signInAs('rec-1', 'RECEPTIONIST')
    mockPrisma.payment.findUnique.mockResolvedValue(null)
    const res = await confirm('missing')
    expect(res.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 404 (not 403) when the caller is outside the property\'s workspace', async () => {
    signInAs('stranger', null)
    const res = await confirm()
    expect(res.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 403 for a member with the USER role', async () => {
    signInAs('user-1', 'USER')
    const res = await confirm()
    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it.each(['RECEPTIONIST', 'MANAGER', 'ADMIN'])('%s can confirm', async (role) => {
    signInAs('staff-1', role)
    const res = await confirm()
    expect(res.status).toBe(200)
  })

  it('workspace owner can confirm', async () => {
    signInAs('owner-1', null)
    const res = await confirm()
    expect(res.status).toBe(200)
  })
})

describe('confirming', () => {
  beforeEach(() => signInAs('rec-1', 'RECEPTIONIST'))

  it('locks the booking, then updates only where status = PENDING, all in one transaction', async () => {
    await confirm()
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    const [sql, bookingId] = tx.$queryRaw.mock.calls[0]
    expect(sql.join('?')).toContain('FOR UPDATE')
    expect(bookingId).toBe('bk-1')
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'PENDING' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    })
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.payment.updateMany.mock.invocationCallOrder[0]
    )
  })

  it('second click (no longer PENDING) → 409, booking untouched, nothing logged', async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 0 })
    const res = await confirm()
    expect(res.status).toBe(409)
    expect(tx.booking.update).not.toHaveBeenCalled()
    expect(tx.activityLog.create).not.toHaveBeenCalled()
  })

  it('fully paid → booking PAID, PENDING → CONFIRMED, depositAmount = total paid', async () => {
    const res = await confirm()
    expect(res.status).toBe(200)
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED', depositAmount: 500000 },
    })
  })

  it('partially paid → booking PARTIAL, CHECKED_IN status kept', async () => {
    tx.booking.findUniqueOrThrow.mockResolvedValue({ status: 'CHECKED_IN', totalAmount: 2000000 })
    tx.payment.aggregate.mockResolvedValue({ _sum: { amount: 500000 } })
    await confirm()
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: { paymentStatus: 'PARTIAL', status: 'CHECKED_IN', depositAmount: 500000 },
    })
  })

  it('logs who confirmed, when, and from which IP', async () => {
    await confirm()
    expect(tx.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'rec-1',
        workspaceId: 'ws-1',
        propertyId: 'prop-1',
        action: 'CONFIRM_PAYMENT',
        entityType: 'PAYMENT',
        entityId: 'pay-1',
        ipAddress: '203.0.113.7',
        userAgent: 'vitest',
        metadata: expect.objectContaining({
          role: 'RECEPTIONIST',
          amount: 500000,
          confirmedAt: expect.any(String),
        }),
      }),
    })
  })

  it.each(['CANCELLED', 'NO_SHOW'])(
    '%s booking: money recorded, booking not reopened, log flagged, warning returned',
    async (status) => {
      tx.booking.findUniqueOrThrow.mockResolvedValue({ status, totalAmount: 500000 })
      const res = await confirm()
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.warning).toBeTruthy()
      expect(tx.payment.updateMany).toHaveBeenCalled()
      expect(tx.booking.update).not.toHaveBeenCalled()
      expect(tx.activityLog.create.mock.calls[0][0].data.metadata).toMatchObject({
        paidAfterClosed: true,
        bookingStatus: status,
      })
    }
  )

  it('DB error inside the transaction → 500, not swallowed as 409', async () => {
    tx.booking.update.mockRejectedValueOnce(new Error('db down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await confirm()
    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})
