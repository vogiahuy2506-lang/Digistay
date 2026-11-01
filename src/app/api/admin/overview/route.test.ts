import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/admin/guard', () => ({
  requirePlatformAdmin: vi.fn(),
}))
vi.mock('@/lib/admin/customers', () => ({
  customersSummary: vi.fn(),
}))
vi.mock('@/lib/admin/orders', () => ({
  ordersSummary: vi.fn(),
}))
vi.mock('@/lib/admin/activity', () => ({
  listActivity: vi.fn(),
}))
vi.mock('@/lib/ops/alerts', () => ({
  findProblems: vi.fn(),
}))
vi.mock('@/lib/ops/health-checks', () => ({
  redisState: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    property: { count: vi.fn() },
    booking: { count: vi.fn() },
    room: { count: vi.fn() },
  },
  prismaWithDeleted: {
    subscriptionPayment: { findMany: vi.fn() },
  },
}))

import { requirePlatformAdmin } from '@/lib/admin/guard'
import { customersSummary } from '@/lib/admin/customers'
import { ordersSummary } from '@/lib/admin/orders'
import { listActivity } from '@/lib/admin/activity'
import { findProblems } from '@/lib/ops/alerts'
import { redisState } from '@/lib/ops/health-checks'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/overview', () => {
  it('returns guard error when user is not super admin or not logged in', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, error: 'Không tìm thấy' }, { status: 404 }),
    })

    const res = await GET()
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns aggregated metrics when authenticated as super admin', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: true,
      admin: { id: 'sa-1', email: 'sa@digistay.vn', name: 'Super Admin' },
    })

    vi.mocked(customersSummary).mockResolvedValueOnce({
      workspaces: 10,
      newWorkspaces: 3,
      byState: { trial: 5, active: 4, grace: 1, locked: 0 },
      paidByPlan: { starter: 2, growth: 2 },
      users: 25,
      lockedUsers: 0,
    })

    vi.mocked(ordersSummary).mockResolvedValueOnce({
      revenueMonth: 25000000,
      paidMonth: 5,
      revenue30d: 30000000,
      pending: 2,
      flagged: 0,
    })

    vi.mocked(prisma.property.count).mockResolvedValueOnce(12)
    vi.mocked(prisma.booking.count).mockResolvedValueOnce(150)
    vi.mocked(prisma.room.count).mockResolvedValueOnce(48)
    vi.mocked(findProblems).mockResolvedValueOnce([])
    vi.mocked(redisState).mockResolvedValueOnce('ok')

    vi.mocked(prismaWithDeleted.subscriptionPayment.findMany).mockResolvedValueOnce([
      {
        id: 'ord-1',
        orderCode: 'SUB-12345',
        amount: 5000000,
        status: 'PAID',
        plan: 'growth',
        billing: 'YEAR',
        createdAt: new Date('2026-11-01T10:00:00Z'),
        workspace: { id: 'ws-1', name: 'Hotel Demo', slug: 'hotel-demo' },
      },
    ] as any)

    vi.mocked(listActivity).mockResolvedValueOnce({
      rows: [
        {
          id: 'act-1',
          action: 'user_login',
          entityType: 'User',
          entityId: 'u-1',
          createdAt: '2026-11-01T10:05:00.000Z',
          actor: { id: 'u-1', name: 'Owner', email: 'owner@demo.vn' },
          workspace: { id: 'ws-1', name: 'Hotel Demo', slug: 'hotel-demo', deleted: false },
          property: null,
          metadata: {},
          changes: null,
          ipAddress: null,
          userAgent: null,
        },
      ],
      nextCursor: null,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.customers.workspaces).toBe(10)
    expect(json.data.orders.revenueMonth).toBe(25000000)
    expect(json.data.scale.properties).toBe(12)
    expect(json.data.scale.bookings).toBe(150)
    expect(json.data.scale.rooms).toBe(48)
    expect(json.data.recentOrders).toHaveLength(1)
    expect(json.data.recentOrders[0].orderCode).toBe('SUB-12345')
    expect(json.data.recentActivity).toHaveLength(1)
    expect(json.data.recentActivity[0].action).toBe('user_login')
    expect(json.data.system.problemsCount).toBe(0)
    expect(json.data.system.redisOk).toBe(true)
  })
})
