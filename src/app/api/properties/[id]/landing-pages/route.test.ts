import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { PageType, PageStatus } from '@prisma/client'

const h = vi.hoisted(() => {
  return {
    session: { current: null as unknown },
    prisma: {
      landingPage: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
    checkPropertyAccess: vi.fn(),
  }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => h.session.current) }))
vi.mock('@/lib/db', () => ({ prisma: h.prisma }))
vi.mock('@/lib/auth/access', () => ({
  checkPropertyAccess: h.checkPropertyAccess,
}))
vi.mock('@/lib/public-site/site', () => ({
  invalidatePublicSite: vi.fn(),
}))

import { GET, POST, normalizeSlug } from './route'
import { GET as GET_PAGE, PUT as PUT_PAGE, DELETE as DELETE_PAGE } from './[pageId]/route'

function getPages(url = 'http://localhost/api/properties/prop_1/landing-pages') {
  return GET(new NextRequest(url), {
    params: Promise.resolve({ id: 'prop_1' }),
  })
}

function postPage(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/properties/prop_1/landing-pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'prop_1' }) }
  )
}

function getPage(pageId: string) {
  return GET_PAGE(new NextRequest(`http://localhost/api/properties/prop_1/landing-pages/${pageId}`), {
    params: Promise.resolve({ id: 'prop_1', pageId }),
  })
}

function putPage(pageId: string, body: unknown) {
  return PUT_PAGE(
    new NextRequest(`http://localhost/api/properties/prop_1/landing-pages/${pageId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'prop_1', pageId }) }
  )
}

function deletePage(pageId: string) {
  return DELETE_PAGE(
    new NextRequest(`http://localhost/api/properties/prop_1/landing-pages/${pageId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id: 'prop_1', pageId }) }
  )
}

beforeEach(() => {
  h.session.current = { user: { id: 'user_1' } }
  h.checkPropertyAccess.mockResolvedValue({ ok: true, property: { id: 'prop_1' } })
  vi.clearAllMocks()
})

describe('normalizeSlug helper', () => {
  it('converts Vietnamese text to clean lowercase slug', () => {
    expect(normalizeSlug('Combo Mùa Hè Rực Rỡ 2026')).toBe('combo-mua-he-ruc-ro-2026')
    expect(normalizeSlug('Khách Sạn & Biệt Thự Đẹp')).toBe('khach-san-biet-thu-dep')
  })
})

describe('GET /api/properties/[id]/landing-pages', () => {
  it('requires authentication', async () => {
    h.session.current = null
    const res = await getPages()
    expect(res.status).toBe(401)
  })

  it('checks website_manage permission', async () => {
    h.checkPropertyAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 }),
    })
    const res = await getPages()
    expect(res.status).toBe(403)
  })

  it('returns list of landing pages', async () => {
    const mockList = [
      { id: 'lp_1', title: 'Combo Hè', slug: 'combo-he', type: PageType.CAMPAIGN_LP, status: PageStatus.PUBLISHED },
    ]
    h.prisma.landingPage.findMany.mockResolvedValue(mockList)

    const res = await getPages()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockList)
  })
})

describe('POST /api/properties/[id]/landing-pages', () => {
  it('rejects empty title', async () => {
    const res = await postPage({ title: '' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('creates landing page and auto-generates slug from title', async () => {
    h.prisma.landingPage.findFirst.mockResolvedValue(null)
    h.prisma.landingPage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'lp_new', ...data })
    )

    const res = await postPage({
      title: 'Khuyến Mãi Cuối Tuần',
      status: PageStatus.DRAFT,
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.slug).toBe('khuyen-mai-cuoi-tuan')
  })

  it('increments slug counter if collision occurs', async () => {
    h.prisma.landingPage.findFirst
      .mockResolvedValueOnce({ id: 'existing_lp' })
      .mockResolvedValueOnce(null)

    h.prisma.landingPage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'lp_new', ...data })
    )

    const res = await postPage({
      title: 'Combo Hè',
      slug: 'combo-he',
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.slug).toBe('combo-he-1')
  })
})

describe('GET /api/properties/[id]/landing-pages/[pageId]', () => {
  it('returns 404 when not found', async () => {
    h.prisma.landingPage.findFirst.mockResolvedValue(null)
    const res = await getPage('lp_none')
    expect(res.status).toBe(404)
  })

  it('returns page details', async () => {
    const page = { id: 'lp_1', title: 'Combo Hè', slug: 'combo-he', blocks: [] }
    h.prisma.landingPage.findFirst.mockResolvedValue(page)
    const res = await getPage('lp_1')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual(page)
  })
})

describe('PUT /api/properties/[id]/landing-pages/[pageId]', () => {
  it('returns 409 if changing to a slug that is already taken by another page', async () => {
    h.prisma.landingPage.findFirst
      .mockResolvedValueOnce({ id: 'lp_1', slug: 'old-slug', status: PageStatus.DRAFT }) // existing
      .mockResolvedValueOnce({ id: 'lp_2' }) // duplicate search

    const res = await putPage('lp_1', { slug: 'taken-slug' })
    expect(res.status).toBe(409)
  })

  it('updates page successfully', async () => {
    h.prisma.landingPage.findFirst.mockResolvedValueOnce({
      id: 'lp_1',
      slug: 'my-slug',
      status: PageStatus.DRAFT,
      publishedAt: null,
    })
    h.prisma.landingPage.update.mockResolvedValueOnce({
      id: 'lp_1',
      title: 'Updated Title',
      slug: 'my-slug',
      status: PageStatus.PUBLISHED,
    })

    const res = await putPage('lp_1', { title: 'Updated Title', status: PageStatus.PUBLISHED })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})

describe('DELETE /api/properties/[id]/landing-pages/[pageId]', () => {
  it('soft deletes the landing page', async () => {
    h.prisma.landingPage.findFirst.mockResolvedValueOnce({ id: 'lp_1' })
    h.prisma.landingPage.update.mockResolvedValueOnce({ id: 'lp_1' })

    const res = await deletePage('lp_1')
    expect(res.status).toBe(200)
    expect(h.prisma.landingPage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lp_1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )
  })
})

