/**
 * The hotel's public site (/<subdomain>, src/app/(public)/[subdomain]/page.tsx),
 * cached: it is the page most visited and its data query the heaviest.
 *
 * The cache is per property, tagged publicSiteTag(id), and lives at most
 * PUBLIC_SITE_TTL_SECONDS. Every route that changes what the site shows
 * calls invalidatePublicSite(propertyId), so an edit shows at once
 * (src/app/api/public-site-cache.test.ts makes sure no such route forgets).
 * Only what the site shows is cached, as plain JSON: never availability or
 * anything per guest. Which property a subdomain names is not cached, so
 * deactivating a hotel or changing its subdomain applies at once.
 */
import { revalidateTag, unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'

export const PUBLIC_SITE_TTL_SECONDS = 300
export const publicSiteTag = (propertyId: string) => `public-site:${propertyId}`

/** Drops the property's cached site; never fails the request that changed it. */
export function invalidatePublicSite(propertyId: string | null | undefined) {
  if (!propertyId) return
  try {
    revalidateTag(publicSiteTag(propertyId))
  } catch (error) {
    // Outside a Next.js request (scripts, tests) there is no cache to drop.
    if (process.env.NODE_ENV === 'production') console.warn('[public-site] revalidateTag failed:', error)
  }
}

/** What the site shows, uncached. null when the property does not exist. */
export async function loadSiteProps(propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      amenities: { include: { amenity: true } },
      roomTypes: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          images: { where: { isPrimary: true } },
          pricing: { take: 1, orderBy: { createdAt: 'asc' } },
          amenities: { include: { amenity: true } },
        },
      },
      websiteSettings: true,
      websiteBlocks: {
        where: { isEnabled: true },
        orderBy: { sortOrder: 'asc' },
      },
      extraServices: { where: { isActive: true } },
    },
  })
  if (!property) return null

  // Fall back to a "default" block layout when the property has none yet
  // so the public site is never blank for a freshly created property.
  const blocks =
    property.websiteBlocks.length > 0
      ? property.websiteBlocks
      : defaultBlocksForProperty(property.type)

  return {
    property: {
      id: property.id,
      name: property.name,
      type: property.type,
      description: property.description,
      address: property.address,
      city: property.city,
      district: property.district,
      country: property.country,
      phone: property.phone,
      email: property.email,
      logo: property.logo,
      coverImage: property.coverImage,
      latitude: property.latitude,
      longitude: property.longitude,
    },
    images: property.images.map((i) => ({
      url: i.url,
      thumbnail: i.thumbnail,
      alt: i.alt,
    })),
    amenities: property.amenities.map((pa) => ({
      id: pa.amenity.id,
      name: pa.amenity.name,
      icon: pa.amenity.icon,
      category: pa.amenity.category,
    })),
    roomTypes: property.roomTypes.map((rt) => ({
      id: rt.id,
      name: rt.name,
      description: rt.description,
      area: rt.area,
      bedType: rt.bedType,
      maxAdults: rt.maxAdults,
      maxChildren: rt.maxChildren,
      totalRooms: rt.totalRooms,
      image: rt.images[0]?.url ?? null,
      fromPrice: rt.pricing[0]?.weekdayPrice ?? null,
      weekendPrice: rt.pricing[0]?.weekendPrice ?? null,
      amenities: rt.amenities.map((a) => a.amenity.name),
    })),
    services: property.extraServices.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      priceType: s.priceType,
      perPerson: s.perPerson,
    })),
    blocks: blocks.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name,
      config: b.config as Record<string, any>,
    })),
    settings: property.websiteSettings
      ? {
          primaryColor: property.websiteSettings.primaryColor,
          secondaryColor: property.websiteSettings.secondaryColor,
          accentColor: property.websiteSettings.accentColor,
          fontFamily: property.websiteSettings.fontFamily,
          headingFont: property.websiteSettings.headingFont,
          layout: property.websiteSettings.layout,
          metaTitle: property.websiteSettings.metaTitle,
          metaDescription: property.websiteSettings.metaDescription,
          isPublished: property.websiteSettings.isPublished,
        }
      : null,
  }
}

export type SiteProps = NonNullable<Awaited<ReturnType<typeof loadSiteProps>>>

export function getPublicSiteProps(propertyId: string) {
  return unstable_cache(() => loadSiteProps(propertyId), ['public-site', propertyId], {
    tags: [publicSiteTag(propertyId)],
    revalidate: PUBLIC_SITE_TTL_SECONDS,
  })()
}

/**
 * Returns a sensible default block layout for a property that has not
 * configured its website yet. The defaults are:
 *   - HERO with a search bar
 *   - ROOMS (auto-filled from RoomType[])
 *   - AMENITIES
 *   - ABOUT
 *   - GALLERY
 *   - MAP
 *   - CONTACT
 *   - FOOTER
 */
function defaultBlocksForProperty(type: string) {
  return [
    {
      id: 'default-hero',
      type: 'HERO',
      name: 'Banner chính',
      config: {
        title: null,
        subtitle: null,
        backgroundImage: null,
        showSearchBar: true,
      },
    },
    {
      id: 'default-rooms',
      type: 'ROOMS',
      name: 'Danh sách phòng',
      config: { title: 'Các hạng phòng', showPrice: true, showCTA: true },
    },
    {
      id: 'default-amenities',
      type: 'AMENITIES',
      name: 'Tiện ích',
      config: { title: 'Tiện ích khách sạn' },
    },
    {
      id: 'default-about',
      type: 'ABOUT',
      name: 'Giới thiệu',
      config: { title: 'Về chúng tôi' },
    },
    {
      id: 'default-gallery',
      type: 'GALLERY',
      name: 'Thư viện ảnh',
      config: { title: 'Hình ảnh' },
    },
    {
      id: 'default-map',
      type: 'MAP',
      name: 'Bản đồ',
      config: { title: 'Vị trí' },
    },
    {
      id: 'default-contact',
      type: 'CONTACT',
      name: 'Liên hệ',
      config: { title: 'Liên hệ đặt phòng' },
    },
    {
      id: 'default-footer',
      type: 'FOOTER',
      name: 'Footer',
      config: {},
    },
  ] as any[]
}
