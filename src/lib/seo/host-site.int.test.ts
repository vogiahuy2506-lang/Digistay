/**
 * What robots.txt and sitemap.xml say for a hotel's host, against real
 * Postgres: only an active, published hotel is open to crawlers, and its
 * sitemap lists its active room types on the canonical origin.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createRoomType, createTenant, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { hostSite } from '@/lib/public-site/site-host'
import { hotelSeoSite } from './host-site'
import { hotelRobots, hotelSitemap } from './robots-sitemap'

beforeEach(async () => {
  await resetDatabase()
  vi.stubEnv('ROOT_DOMAIN', 'digistay.vn')
  vi.stubEnv('NEXTAUTH_URL', 'https://digistay.vn')
})
afterAll(() => prisma.$disconnect())

const hotelHost = (subdomain: string) => {
  const host = hostSite(`${subdomain}.digistay.vn`)
  if (host.kind === 'digistay') throw new Error('not a hotel host')
  return host
}

describe('robots.txt and sitemap.xml of a hotel host', () => {
  it('stay closed until the site is published, and close again when the hotel is deactivated', async () => {
    const { property } = await createTenant()
    const host = hotelHost(property.subdomain)
    expect(await hotelSeoSite(host)).toBeNull()
    expect(hotelRobots(await hotelSeoSite(host)).rules).toEqual({ userAgent: '*', disallow: '/' })

    await publishSite(property.id)
    expect(hotelRobots(await hotelSeoSite(host)).rules).toEqual({ userAgent: '*', allow: '/', disallow: '/api/' })

    await prisma.property.update({ where: { id: property.id }, data: { isActive: false } })
    expect(await hotelSeoSite(host)).toBeNull()
  })

  it('list the active room types on the canonical origin', async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const open = await createRoomType(property.id, { name: 'Deluxe' })
    const closed = await createRoomType(property.id, { name: 'Old' })
    await prisma.roomType.update({ where: { id: closed.id }, data: { isActive: false } })

    const site = await hotelSeoSite(hotelHost(property.subdomain), { rooms: true })
    const origin = `https://${property.subdomain}.digistay.vn`
    expect(site?.origin).toBe(origin)
    expect(hotelSitemap(site).map((e) => e.url)).toEqual([`${origin}/`, `${origin}/en`, `${origin}/rooms/${open.id}`, `${origin}/en/rooms/${open.id}`])
  })

  it("answer on the hotel's own domain once verified, and move the canonical origin there once it has a certificate", async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const domain = { kind: 'other', hostname: 'khachsan-test.vn' } as const
    await prisma.websiteSettings.update({
      where: { propertyId: property.id },
      data: { customDomain: 'khachsan-test.vn', domainVerificationStatus: 'pending' },
    })
    expect(await hotelSeoSite(domain)).toBeNull()

    await prisma.websiteSettings.update({ where: { propertyId: property.id }, data: { domainVerificationStatus: 'verified' } })
    expect((await hotelSeoSite(domain))?.origin).toBe(`https://${property.subdomain}.digistay.vn`)

    await prisma.websiteSettings.update({ where: { propertyId: property.id }, data: { sslEnabled: true } })
    expect((await hotelSeoSite(domain))?.origin).toBe('https://khachsan-test.vn')
    expect((await hotelSeoSite(hotelHost(property.subdomain)))?.origin).toBe('https://khachsan-test.vn')
  })
})
