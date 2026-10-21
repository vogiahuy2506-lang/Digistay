/**
 * Which blocks a hotel's site shows (loadSiteProps) against real Postgres:
 * the default layout only for a site never laid out; blocks the hotel
 * turned off stay off, even when that is all of them.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'
import { loadSiteProps } from './site'

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

async function blockTypes(propertyId: string) {
  return (await loadSiteProps(propertyId))!.blocks.map((b) => b.type)
}

describe('site blocks', () => {
  it('a site never laid out gets the default layout', async () => {
    const { property } = await createTenant()

    expect((await blockTypes(property.id)).length).toBeGreaterThan(0)
  })

  it('shows only the blocks turned on, in their order', async () => {
    const { property } = await createTenant()
    await prisma.websiteBlock.createMany({
      data: [
        { propertyId: property.id, type: 'ROOMS', name: 'Phòng', sortOrder: 1 },
        { propertyId: property.id, type: 'HERO', name: 'Banner', sortOrder: 0 },
        { propertyId: property.id, type: 'MAP', name: 'Bản đồ', sortOrder: 2, isEnabled: false },
      ],
    })

    expect(await blockTypes(property.id)).toEqual(['HERO', 'ROOMS'])
  })

  it('every block turned off shows none, not the default layout', async () => {
    const { property } = await createTenant()
    await prisma.websiteBlock.createMany({
      data: [
        { propertyId: property.id, type: 'HERO', name: 'Banner', isEnabled: false },
        { propertyId: property.id, type: 'ROOMS', name: 'Phòng', sortOrder: 1, isEnabled: false },
      ],
    })

    expect(await blockTypes(property.id)).toEqual([])
  })
})
