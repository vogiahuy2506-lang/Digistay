/**
 * What the website builder loads (GET /api/website/blocks), against real
 * Postgres: the site's real rooms and prices for the preview, and for a site
 * never laid out the default layout the site shows, so the builder starts
 * from it instead of "no blocks".
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createRoomType, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { loadSiteProps } from '@/lib/public-site/site'
import { GET } from './blocks/route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
const load = async (propertyId: string) => {
  const res = await GET(new NextRequest(`http://localhost/api/website/blocks?propertyId=${propertyId}`))
  return { status: res.status, body: await res.json() }
}

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('GET /api/website/blocks', () => {
  it('a site never laid out: no saved blocks, the default layout the site shows, the real rooms and prices', async () => {
    const { owner, property } = await createTenant()
    await createRoomType(property.id, { name: 'Phòng Deluxe', weekdayPrice: 1_250_000, weekendPrice: 1_400_000 })
    await createRoomType(property.id, { name: 'Phòng chưa có giá', weekdayPrice: null })
    signInAs(owner)

    const { status, body } = await load(property.id)

    expect(status).toBe(200)
    expect(body.data.blocks).toEqual([])
    // Exactly what the site renders (src/lib/public-site/site.ts), footer included.
    const siteBlocks = (await loadSiteProps(property.id))!.blocks
    expect(siteBlocks.length).toBeGreaterThan(0)
    expect(body.data.site.defaultBlocks).toEqual(siteBlocks)
    expect(body.data.site.property).toMatchObject({ id: property.id, name: property.name })
    const rooms = Object.fromEntries(body.data.site.roomTypes.map((r: { name: string; fromPrice: number | null }) => [r.name, r.fromPrice]))
    expect(rooms).toEqual({ 'Phòng Deluxe': 1_250_000, 'Phòng chưa có giá': null })
  })

  it('a site laid out: its own blocks, no default layout', async () => {
    const { owner, property } = await createTenant()
    await prisma.websiteBlock.create({ data: { propertyId: property.id, type: 'ROOMS', name: 'Phòng', isEnabled: false } })
    signInAs(owner)

    const { body } = await load(property.id)

    expect(body.data.blocks.map((b: { type: string }) => b.type)).toEqual(['ROOMS'])
    expect(body.data.site.defaultBlocks).toEqual([])
  })

  it('someone outside the workspace gets nothing', async () => {
    const { property } = await createTenant()
    signInAs(await createUser())

    const { status, body } = await load(property.id)

    expect(status).toBe(403)
    expect(body.data).toBeUndefined()
  })
})
