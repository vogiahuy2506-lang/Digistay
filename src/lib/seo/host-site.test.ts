/**
 * Which hotel robots.txt and sitemap.xml describe: the query conditions
 * (unit test, Prisma mocked: it shows the conditions, not that they run).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    property: { findFirst: vi.fn() },
    roomType: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/db'
import { hotelSeoSite } from './host-site'

const findFirst = vi.mocked(prisma.property.findFirst)
const findMany = vi.mocked(prisma.roomType.findMany)

const hotel = {
  id: 'p1',
  subdomain: 'may-bien',
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  websiteSettings: {
    updatedAt: new Date('2026-10-05T00:00:00Z'),
    customDomain: null,
    domainVerificationStatus: null,
    sslEnabled: false,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ROOT_DOMAIN', 'digistay.vn')
  vi.stubEnv('NEXTAUTH_URL', 'https://digistay.vn')
})

describe('hotelSeoSite', () => {
  it('only finds an active, published hotel by its subdomain', async () => {
    findFirst.mockResolvedValue(hotel as never)
    const site = await hotelSeoSite({ kind: 'subdomain', subdomain: 'may-bien' })
    const where = findFirst.mock.calls[0][0]!.where
    expect(where).toEqual({ subdomain: 'may-bien', isActive: true, websiteSettings: { is: { isPublished: true } } })
    expect(site).toEqual({ origin: 'https://may-bien.digistay.vn', updatedAt: hotel.websiteSettings.updatedAt, rooms: [] })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('finds a hotel by its own domain only once that is verified', async () => {
    findFirst.mockResolvedValue(null)
    expect(await hotelSeoSite({ kind: 'other', hostname: 'khachsanmaybien.vn' })).toBeNull()
    expect(findFirst.mock.calls[0][0]!.where).toEqual({
      isActive: true,
      websiteSettings: { is: { isPublished: true, customDomain: 'khachsanmaybien.vn', domainVerificationStatus: 'verified' } },
    })
  })

  it('does not look up an empty host', async () => {
    expect(await hotelSeoSite({ kind: 'other', hostname: '' })).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('lists the active room types for the sitemap, ids and dates only', async () => {
    findFirst.mockResolvedValue({ ...hotel, websiteSettings: null } as never)
    findMany.mockResolvedValue([{ id: 'r1', updatedAt: hotel.updatedAt }] as never)
    const site = await hotelSeoSite({ kind: 'subdomain', subdomain: 'may-bien' }, { rooms: true })
    expect(findMany).toHaveBeenCalledWith({
      where: { propertyId: 'p1', isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, updatedAt: true },
    })
    expect(site?.rooms).toEqual([{ id: 'r1', updatedAt: hotel.updatedAt }])
    expect(site?.updatedAt).toEqual(hotel.updatedAt)
  })
})
