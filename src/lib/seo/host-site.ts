/**
 * The hotel a robots.txt / sitemap.xml request's host names, if search
 * engines may see it: active and published. Crawlers are never signed in,
 * so a preview counts as unpublished (visibility.ts).
 */
import { prisma } from '@/lib/db'
import { SITE_DOMAIN_SELECT, canonicalSiteOrigin, type HostSite } from '@/lib/public-site/site-host'
import type { HotelSeoSite } from './robots-sitemap'

const HOTEL_SELECT = {
  id: true,
  subdomain: true,
  updatedAt: true,
  websiteSettings: { select: { updatedAt: true, ...SITE_DOMAIN_SELECT } },
} as const

async function findHotel(host: Exclude<HostSite, { kind: 'digistay' }>) {
  if (host.kind === 'subdomain') {
    return prisma.property.findFirst({
      where: { subdomain: host.subdomain, isActive: true, websiteSettings: { is: { isPublished: true } } },
      select: HOTEL_SELECT,
    })
  }
  if (!host.hostname) return null
  // A hotel's own domain, once verified (an unverified one is only a claim).
  return prisma.property.findFirst({
    where: {
      isActive: true,
      websiteSettings: { is: { isPublished: true, customDomain: host.hostname, domainVerificationStatus: 'verified' } },
    },
    select: HOTEL_SELECT,
  })
}

/** null: nothing on this host for crawlers. With `rooms`, its active room types too (for the sitemap). */
export async function hotelSeoSite(host: Exclude<HostSite, { kind: 'digistay' }>, { rooms = false } = {}): Promise<HotelSeoSite | null> {
  const hotel = await findHotel(host)
  if (!hotel) return null
  const settingsUpdated = hotel.websiteSettings?.updatedAt
  return {
    origin: canonicalSiteOrigin(hotel.subdomain, hotel.websiteSettings),
    updatedAt: settingsUpdated && settingsUpdated > hotel.updatedAt ? settingsUpdated : hotel.updatedAt,
    rooms: rooms
      ? await prisma.roomType.findMany({
          where: { propertyId: hotel.id, isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, updatedAt: true },
        })
      : [],
  }
}
