import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './voucher/validate/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    platformVoucher: {
      findUnique: vi.fn(),
    },
  },
}))
vi.mock('@/lib/plans/dynamic-plans', () => ({
  getPlatformPlanPrice: vi.fn(async (plan: string, billing: string) => {
    if (plan === 'growth') return billing === 'YEAR' ? 3990000 : 399000
    return 199000
  }),
}))

describe('POST /api/billing/voucher/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const req = new NextRequest('http://localhost/api/billing/voucher/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'SALE50', plan: 'growth', billing: 'MONTH' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects invalid or expired voucher', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'usr1' } } as any)
    vi.mocked(prisma.platformVoucher.findUnique).mockResolvedValueOnce(null)
    const req = new NextRequest('http://localhost/api/billing/voucher/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'INVALID', plan: 'growth', billing: 'MONTH' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('validates a PERCENT voucher and calculates discount correctly', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'usr1' } } as any)
    vi.mocked(prisma.platformVoucher.findUnique).mockResolvedValueOnce({
      id: 'v1',
      code: 'SALE20',
      name: 'Giảm 20%',
      discountType: 'PERCENT',
      discountValue: 20,
      maxDiscount: 100000,
      minOrderAmount: null,
      startDate: new Date(Date.now() - 10000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 100,
      usageCount: 5,
      applicablePlans: null,
      isActive: true,
      deletedAt: null,
    } as any)

    const req = new NextRequest('http://localhost/api/billing/voucher/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'SALE20', plan: 'growth', billing: 'MONTH' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.code).toBe('SALE20')
    // 399,000 * 20% = 79,800 <= maxDiscount 100,000
    expect(json.data.discountAmount).toBe(79800)
    expect(json.data.finalAmount).toBe(399000 - 79800)
  })
})
