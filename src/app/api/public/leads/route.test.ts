import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
      async get(key: string) {
        return data.get(key) ?? null
      },
      async incr(key: string) {
        const n = Number(data.get(key) ?? 0) + 1
        data.set(key, String(n))
        return n
      },
      async expire() {
        return 1
      },
      async ttl() {
        return 300
      },
    },
    prisma: {
      property: {
        findFirst: vi.fn(),
      },
      coupon: {
        findFirst: vi.fn(),
      },
      lead: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      landingPage: {
        update: vi.fn().mockResolvedValue({ id: 'lp_1' }),
      },
    },
  }
})

vi.mock('@/lib/db/redis', () => ({ redis: h.redis }))
vi.mock('@/lib/db', () => ({ prisma: h.prisma }))

import { POST } from './route'

function postLead(body: unknown, ip = '198.51.100.12') {
  return POST(
    new NextRequest('http://localhost/api/public/leads', {
      method: 'POST',
      headers: {
        'x-real-ip': ip,
        'content-type': 'application/json',
        referer: 'http://myhotel.digistay.vn/',
      },
      body: JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  h.data.clear()
  vi.clearAllMocks()
})

describe('POST /api/public/leads (task 43)', () => {
  it('refuses invalid emails and missing propertyId', async () => {
    const res1 = await postLead({ propertyId: '', email: 'guest@example.com' })
    expect(res1.status).toBe(400)
    const data1 = await res1.json()
    expect(data1.success).toBe(false)

    const res2 = await postLead({ propertyId: 'prop_1', email: 'invalid-email' })
    expect(res2.status).toBe(400)
    const data2 = await res2.json()
    expect(data2.error).toContain('Email')
  })

  it('returns 404 when hotel does not exist or site is not published', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce(null)
    const res = await postLead({ propertyId: 'prop_missing', email: 'guest@example.com' })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it('creates a new lead and returns the configured active coupon', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce({
      id: 'prop_1',
      websiteSettings: { exitIntentEnabled: true, exitIntentCouponId: 'coup_1' },
    })
    h.prisma.coupon.findFirst.mockResolvedValueOnce({
      id: 'coup_1',
      code: 'DISCOUNT10',
      name: 'Giảm 10%',
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscount: 500000,
      minOrderAmount: null,
    })
    h.prisma.lead.findFirst.mockResolvedValueOnce(null)
    h.prisma.lead.create.mockResolvedValueOnce({
      id: 'lead_1',
      email: 'guest@example.com',
    })

    const res = await postLead({ propertyId: 'prop_1', email: 'Guest@Example.COM' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.lead.email).toBe('guest@example.com')
    expect(data.data.coupon.code).toBe('DISCOUNT10')

    expect(h.prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId: 'prop_1',
        email: 'guest@example.com',
        source: 'EXIT_POPUP',
      }),
      select: { id: true, email: true },
    })
  })

  it('updates an existing lead when same email visits again', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce({
      id: 'prop_1',
      websiteSettings: { exitIntentEnabled: true, exitIntentCouponId: null },
    })
    h.prisma.lead.findFirst.mockResolvedValueOnce({ id: 'lead_existing' })
    h.prisma.lead.update.mockResolvedValueOnce({
      id: 'lead_existing',
      email: 'guest@example.com',
    })

    const res = await postLead({ propertyId: 'prop_1', email: 'guest@example.com' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(h.prisma.lead.update).toHaveBeenCalled()
    expect(h.prisma.lead.create).not.toHaveBeenCalled()
  })

  it('omits coupon if coupon usage limit has been reached', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce({
      id: 'prop_1',
      websiteSettings: { exitIntentEnabled: true, exitIntentCouponId: 'coup_exhausted' },
    })
    h.prisma.coupon.findFirst.mockResolvedValueOnce({
      id: 'coup_exhausted',
      code: 'EXHAUSTED',
      name: 'Hết lượt',
      discountType: 'PERCENT',
      discountValue: 15,
      maxDiscount: null,
      minOrderAmount: null,
      usageLimit: 5,
      usageCount: 5,
    })
    h.prisma.lead.findFirst.mockResolvedValueOnce(null)
    h.prisma.lead.create.mockResolvedValueOnce({
      id: 'lead_2',
      email: 'guest2@example.com',
    })

    const res = await postLead({ propertyId: 'prop_1', email: 'guest2@example.com' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.coupon).toBeNull()
  })

  it('enforces rate limiting per IP', async () => {
    h.prisma.property.findFirst.mockResolvedValue({
      id: 'prop_1',
      websiteSettings: { exitIntentEnabled: true, exitIntentCouponId: null },
    })
    h.prisma.lead.findFirst.mockResolvedValue(null)
    h.prisma.lead.create.mockResolvedValue({ id: 'lead_x', email: 'guest@example.com' })

    const ip = '203.0.113.88'
    for (let i = 0; i < 10; i++) {
      const res = await postLead({ propertyId: 'prop_1', email: `guest${i}@example.com` }, ip)
      expect(res.status).toBe(200)
    }

    // 11th request from same IP should be blocked
    const blocked = await postLead({ propertyId: 'prop_1', email: 'guest11@example.com' }, ip)
    expect(blocked.status).toBe(429)
    const data = await blocked.json()
    expect(data.error).toContain('thử lại')
  })

  it('captures lead with name, phone, landingPageId and increments landing page leadCount', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce({
      id: 'prop_1',
      websiteSettings: { exitIntentEnabled: false, exitIntentCouponId: null },
    })
    h.prisma.lead.findFirst.mockResolvedValueOnce(null)
    h.prisma.lead.create.mockResolvedValueOnce({
      id: 'lead_campaign',
      email: 'campaign_guest@example.com',
    })

    const res = await postLead({
      propertyId: 'prop_1',
      landingPageId: 'lp_summer',
      email: 'campaign_guest@example.com',
      name: 'Nguyen Van A',
      phone: '0912345678',
      source: 'LANDING_PAGE',
    })

    expect(res.status).toBe(200)
    expect(h.prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'campaign_guest@example.com',
          name: 'Nguyen Van A',
          phone: '0912345678',
          source: 'LANDING_PAGE',
          metadata: expect.objectContaining({
            landingPageId: 'lp_summer',
          }),
        }),
      })
    )
    expect(h.prisma.landingPage.update).toHaveBeenCalledWith({
      where: { id: 'lp_summer' },
      data: { leadCount: { increment: 1 } },
    })
  })
})


