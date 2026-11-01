import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  return {
    session: { current: null as unknown },
    prisma: {
      property: {
        findFirst: vi.fn(),
      },
      lead: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
    checkPropertyAccess: vi.fn(),
  }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => h.session.current) }))
vi.mock('@/lib/db', () => ({ prisma: h.prisma }))
vi.mock('@/lib/auth/access', () => ({
  accessibleProperties: vi.fn(() => ({})),
  checkPropertyAccess: h.checkPropertyAccess,
}))

import { GET } from './route'
import { PATCH, DELETE } from './[leadId]/route'

function getLeads(url: string) {
  return GET(new NextRequest(`http://localhost${url}`), {
    params: Promise.resolve({ id: 'prop_1' }),
  })
}

function patchLead(leadId: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/properties/prop_1/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'prop_1', leadId }) }
  )
}

function deleteLead(leadId: string) {
  return DELETE(
    new NextRequest(`http://localhost/api/properties/prop_1/leads/${leadId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id: 'prop_1', leadId }) }
  )
}

beforeEach(() => {
  h.session.current = { user: { id: 'user_1' } }
  vi.clearAllMocks()
})

describe('GET /api/properties/[id]/leads (task 44)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    h.session.current = null
    const res = await getLeads('/api/properties/prop_1/leads')
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it('rejects unauthorized members with 403', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce(null)
    const res = await getLeads('/api/properties/prop_1/leads')
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it('returns paginated list of leads and summary counts', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce({ id: 'prop_1', name: 'Khách sạn Biển Đông' })
    const mockLeads = [
      {
        id: 'lead_1',
        propertyId: 'prop_1',
        email: 'test@example.com',
        name: 'Nguyen Van A',
        phone: '0901234567',
        source: 'EXIT_POPUP',
        metadata: { couponCode: 'DISCOUNT10', page: '/rooms' },
        notes: 'Cần phòng view biển',
        createdAt: new Date('2026-03-01T10:00:00Z'),
      },
    ]
    h.prisma.lead.findMany.mockResolvedValueOnce(mockLeads)
    h.prisma.lead.count
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1) // exitPopupCount
      .mockResolvedValueOnce(0) // contactFormCount

    const res = await getLeads('/api/properties/prop_1/leads?page=1&limit=20')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].email).toBe('test@example.com')
    expect(body.pagination.total).toBe(1)
    expect(body.summary.exitPopupCount).toBe(1)
    expect(body.summary.contactFormCount).toBe(0)
  })

  it('filters by source and search query', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce({ id: 'prop_1', name: 'Khách sạn' })
    h.prisma.lead.findMany.mockResolvedValueOnce([])
    h.prisma.lead.count.mockResolvedValue(0)

    const res = await getLeads('/api/properties/prop_1/leads?q=nguyen&source=EXIT_POPUP')
    expect(res.status).toBe(200)
    expect(h.prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          propertyId: 'prop_1',
          source: 'EXIT_POPUP',
          OR: expect.arrayContaining([
            { email: { contains: 'nguyen', mode: 'insensitive' } },
            { name: { contains: 'nguyen', mode: 'insensitive' } },
            { phone: { contains: 'nguyen', mode: 'insensitive' } },
          ]),
        }),
      })
    )
  })

  it('exports matching leads to CSV with UTF-8 BOM', async () => {
    h.prisma.property.findFirst.mockResolvedValueOnce({ id: 'prop_1', name: 'Khách sạn' })
    h.prisma.lead.findMany.mockResolvedValueOnce([
      {
        id: 'lead_1',
        propertyId: 'prop_1',
        email: 'khach@example.com',
        name: 'Trần Văn B',
        phone: '0912345678',
        source: 'EXIT_POPUP',
        metadata: { couponCode: 'SALE20' },
        notes: 'Đã gọi tư vấn',
        createdAt: new Date('2026-03-01T12:00:00Z'),
      },
    ])

    const res = await getLeads('/api/properties/prop_1/leads?export=csv')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('attachment; filename="leads-prop_1-')

    const buffer = Buffer.from(await res.arrayBuffer())
    expect(buffer[0]).toBe(0xef)
    expect(buffer[1]).toBe(0xbb)
    expect(buffer[2]).toBe(0xbf)
    const csvText = buffer.toString('utf-8')
    expect(csvText).toContain('khach@example.com')
    expect(csvText).toContain('Trần Văn B')
    expect(csvText).toContain('SALE20')
    expect(csvText).toContain('Popup giữ chân')
  })
})

describe('PATCH /api/properties/[id]/leads/[leadId] (task 44)', () => {
  it('updates lead notes and contact details', async () => {
    h.checkPropertyAccess.mockResolvedValueOnce({ ok: true })
    h.prisma.lead.findFirst.mockResolvedValueOnce({ id: 'lead_1', propertyId: 'prop_1' })
    h.prisma.lead.update.mockResolvedValueOnce({
      id: 'lead_1',
      notes: 'Khách quan tâm Deluxe',
      name: 'Lê Văn C',
      phone: '0988776655',
    })

    const res = await patchLead('lead_1', {
      notes: 'Khách quan tâm Deluxe',
      name: 'Lê Văn C',
      phone: '0988776655',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.notes).toBe('Khách quan tâm Deluxe')
    expect(h.prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead_1' },
      data: {
        notes: 'Khách quan tâm Deluxe',
        name: 'Lê Văn C',
        phone: '0988776655',
      },
    })
  })

  it('returns 404 when lead is not found', async () => {
    h.checkPropertyAccess.mockResolvedValueOnce({ ok: true })
    h.prisma.lead.findFirst.mockResolvedValueOnce(null)

    const res = await patchLead('lead_missing', { notes: 'hello' })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

describe('DELETE /api/properties/[id]/leads/[leadId] (task 44)', () => {
  it('deletes an existing lead', async () => {
    h.checkPropertyAccess.mockResolvedValueOnce({ ok: true })
    h.prisma.lead.findFirst.mockResolvedValueOnce({ id: 'lead_1', propertyId: 'prop_1' })
    h.prisma.lead.delete.mockResolvedValueOnce({ id: 'lead_1' })

    const res = await deleteLead('lead_1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(h.prisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead_1' } })
  })

  it('returns 404 when lead to delete does not exist', async () => {
    h.checkPropertyAccess.mockResolvedValueOnce({ ok: true })
    h.prisma.lead.findFirst.mockResolvedValueOnce(null)

    const res = await deleteLead('lead_missing')
    expect(res.status).toBe(404)
  })
})
