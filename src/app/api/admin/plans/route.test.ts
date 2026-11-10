import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/admin/guard', () => ({
  requirePlatformAdmin: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    platformPlan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    subscription: {
      count: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}))

import { requirePlatformAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db'
import { GET as getPlans, POST as createPlan, PUT as updatePlan } from './route'
import { DELETE as deletePlan } from './[id]/route'

const mockAdmin = { id: 'admin-1', email: 'admin@digistay.vn', role: 'SUPER_ADMIN' }

describe('Admin Plans API (/api/admin/plans)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      ok: true,
      admin: mockAdmin as any,
    })
  })

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    })

    const res = await getPlans()
    expect(res.status).toBe(401)
  })

  it('GET returns all plans', async () => {
    vi.mocked(prisma.platformPlan.findMany).mockResolvedValueOnce([
      { id: 'starter', name: 'Starter', price: 199_000, isPublic: true, isActive: true },
      { id: 'custom-vip', name: 'VIP Resort', price: 2_000_000, isPublic: false, isActive: true },
    ] as any)

    const res = await getPlans()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(2)
  })

  it('POST creates a new custom plan and logs activity', async () => {
    vi.mocked(prisma.platformPlan.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.platformPlan.create).mockResolvedValueOnce({
      id: 'custom-chain',
      name: 'Chuỗi Khách Sạn VIP',
      price: 1_200_000,
      isPublic: false,
    } as any)

    const req = new NextRequest('http://localhost/api/admin/plans', {
      method: 'POST',
      body: JSON.stringify({
        id: 'custom-chain',
        name: 'Chuỗi Khách Sạn VIP',
        price: 1_200_000,
        properties: 10,
        rooms: 250,
        isPublic: false,
      }),
    })

    const res = await createPlan(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.platformPlan.create).toHaveBeenCalled()
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CREATE_PLAN',
          entityType: 'PLATFORM_PLAN',
          entityId: 'custom-chain',
        }),
      })
    )
  })

  it('POST rejects duplicate plan id', async () => {
    vi.mocked(prisma.platformPlan.findUnique).mockResolvedValueOnce({
      id: 'growth',
    } as any)

    const req = new NextRequest('http://localhost/api/admin/plans', {
      method: 'POST',
      body: JSON.stringify({
        id: 'growth',
        name: 'Growth Duplicate',
        price: 399_000,
      }),
    })

    const res = await createPlan(req)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.success).toBe(false)
  })

  it('DELETE refuses to delete core plans (starter, growth, business)', async () => {
    const req = new NextRequest('http://localhost/api/admin/plans/growth', { method: 'DELETE' })
    const res = await deletePlan(req, { params: Promise.resolve({ id: 'growth' }) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Không thể xóa gói cốt lõi')
    expect(prisma.platformPlan.delete).not.toHaveBeenCalled()
  })

  it('DELETE refuses to delete custom plan currently in use by subscriptions', async () => {
    vi.mocked(prisma.subscription.count).mockResolvedValueOnce(3)

    const req = new NextRequest('http://localhost/api/admin/plans/vip-used', { method: 'DELETE' })
    const res = await deletePlan(req, { params: Promise.resolve({ id: 'vip-used' }) })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toContain('hiện có 3 workspace đang sử dụng')
    expect(prisma.platformPlan.delete).not.toHaveBeenCalled()
  })

  it('DELETE successfully removes unused custom plan and logs activity', async () => {
    vi.mocked(prisma.subscription.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.platformPlan.delete).mockResolvedValueOnce({ id: 'custom-unused' } as any)

    const req = new NextRequest('http://localhost/api/admin/plans/custom-unused', { method: 'DELETE' })
    const res = await deletePlan(req, { params: Promise.resolve({ id: 'custom-unused' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.platformPlan.delete).toHaveBeenCalledWith({ where: { id: 'custom-unused' } })
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DELETE_PLAN',
          entityType: 'PLATFORM_PLAN',
          entityId: 'custom-unused',
        }),
      })
    )
  })
})
