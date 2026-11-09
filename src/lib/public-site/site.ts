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
import type { Locale } from '@/i18n/locales'
import { localizeRow } from '@/lib/i18n/content'
import { localizeMenuItems, sortMenuItems } from '@/lib/menu/menu'
import { prisma } from '@/lib/db'
import { ratesFrom } from '@/lib/pricing/quote'
import { ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'

export const PUBLIC_SITE_TTL_SECONDS = 300
export const publicSiteTag = (propertyId: string) => `public-site:${propertyId}`

export const DEFAULT_STARTER_AMENITIES = [
  { id: 'def-wifi', slug: 'wifi', name: 'Wifi tốc độ cao miễn phí', icon: 'wifi', category: 'internet', isFeatured: true, customName: null, images: [], sortOrder: 0 },
  { id: 'def-ac', slug: 'ac', name: 'Điều hòa không khí', icon: 'snowflake', category: 'room', isFeatured: true, customName: null, images: [], sortOrder: 1 },
  { id: 'def-parking', slug: 'parking', name: 'Bãi đỗ xe an toàn', icon: 'car', category: 'transport', isFeatured: false, customName: null, images: [], sortOrder: 2 },
  { id: 'def-desk', slug: 'front-desk', name: 'Lễ tân phục vụ 24/7', icon: 'concierge', category: 'service', isFeatured: false, customName: null, images: [], sortOrder: 3 },
  { id: 'def-clean', slug: 'housekeeping', name: 'Dọn phòng hàng ngày', icon: 'sparkles', category: 'service', isFeatured: false, customName: null, images: [], sortOrder: 4 },
  { id: 'def-water', slug: 'free-water', name: 'Nước uống miễn phí', icon: 'glass-water', category: 'dining', isFeatured: false, customName: null, images: [], sortOrder: 5 },
]

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
      amenities: {
        include: { amenity: true },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      },
      roomTypes: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          images: { where: { isPrimary: true } },
          ...ROOM_RATE_INCLUDE,
          amenities: { include: { amenity: true } },
        },
      },
      websiteSettings: true,
      // All of them, turned off or not: see `blocks` below.
      websiteBlocks: {
        orderBy: { sortOrder: 'asc' },
      },
      extraServices: { where: { isActive: true } },
      // Hidden dishes stay in the dashboard only.
      menuItems: { where: { isAvailable: true } },
    },
  })
  if (!property) return null
  // The same rates a booking is charged (src/lib/pricing/quote.ts).
    const [defaults, publishedReviews] = await Promise.all([
    propertyRateDefaults(prisma, propertyId),
    prisma.review.findMany({
      where: { propertyId, isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { guestName: true, rating: true, comment: true },
    }),
  ])

  const blocks = siteBlocks(property.websiteBlocks, property.type)

  let siteAmenities = property.amenities
    .filter((pa) => pa.amenity)
    .map((pa) => ({
      id: pa.amenity.id,
      slug: pa.amenity.slug,
      name: pa.customName || pa.amenity.name,
      icon: pa.amenity.icon,
      category: pa.amenity.category,
      isFeatured: pa.isFeatured,
      customName: pa.customName,
      images: pa.images,
      sortOrder: pa.sortOrder,
    }))

  // Fallback: If property has not specifically configured property-level amenities yet,
  // collect unique amenities from its active room types so the hotel website displays them!
  if (siteAmenities.length === 0) {
    const seen = new Set<string>()
    for (const rt of property.roomTypes) {
      for (const rta of rt.amenities) {
        if (rta.amenity && !seen.has(rta.amenity.id)) {
          seen.add(rta.amenity.id)
          siteAmenities.push({
            id: rta.amenity.id,
            slug: rta.amenity.slug,
            name: rta.amenity.name,
            icon: rta.amenity.icon,
            category: rta.amenity.category,
            isFeatured: false,
            customName: null,
            images: [],
            sortOrder: siteAmenities.length,
          })
        }
      }
    }
  }

  // If both property-level and room-level amenities are empty, provide standard starter amenities
  if (siteAmenities.length === 0) {
    siteAmenities = [...DEFAULT_STARTER_AMENITIES]
  }

  return {
    property: {
      id: property.id,
      name: property.name,
      type: property.type,
      description: property.description,
      address: property.address,
      city: property.city,
      ward: property.ward,
      district: property.district,
      country: property.country,
      phone: property.phone,
      email: property.email,
      logo: property.logo,
      coverImage: property.coverImage,
      latitude: property.latitude,
      longitude: property.longitude,
      translations: property.translations,
    },
    images: property.images.map((i) => ({
      url: i.url,
      thumbnail: i.thumbnail,
      alt: i.alt,
    })),
    amenities: siteAmenities,
    roomTypes: property.roomTypes.map((rt) => {
      const roomAmenities = rt.amenities.filter((a) => a.amenity).map((a) => a.amenity.name)
      const roomAmenitySlugs = rt.amenities.filter((a) => a.amenity).map((a) => a.amenity.slug)
      return {
        id: rt.id,
        name: rt.name,
        description: rt.description,
        area: rt.area,
        bedType: rt.bedType,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        totalRooms: rt.totalRooms,
        image: rt.images[0]?.url ?? null,
        fromPrice: ratesFrom(rt.pricing[0], defaults)?.weekdayPrice ?? null,
        weekendPrice: ratesFrom(rt.pricing[0], defaults)?.weekendPrice ?? null,
        amenities: roomAmenities.length > 0 ? roomAmenities : siteAmenities.slice(0, 4).map((a) => a.name),
        amenitySlugs: roomAmenitySlugs.length > 0 ? roomAmenitySlugs : siteAmenities.slice(0, 4).map((a) => a.slug),
        translations: rt.translations,
      }
    }),
    services: property.extraServices.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      priceType: s.priceType,
      perPerson: s.perPerson,
      translations: s.translations,
    })),
    menuItems: sortMenuItems(property.menuItems).map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      price: m.price,
      imageUrl: m.imageUrl,
      category: m.category,
      sortOrder: m.sortOrder,
      translations: m.translations,
    })),
    blocks: blocks.map((b) => {
      if (b.type === 'REVIEWS') {
        const cfg = (b.config as Record<string, any>) || {}
        const existingReviews = Array.isArray(cfg.reviews) ? cfg.reviews : []
        const mappedPublished = publishedReviews.map((r) => ({
          name: r.guestName,
          text: r.comment,
          rating: r.rating,
          source: 'Digistay Verified Guest',
        }))
        return {
          id: b.id,
          type: b.type,
          name: b.name,
          config: {
            ...cfg,
            reviews: [...mappedPublished, ...existingReviews],
          },
        }
      }
      return {
        id: b.id,
        type: b.type,
        name: b.name,
        config: b.config as Record<string, any>,
      }
    }),
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
          translations: property.websiteSettings.translations,
        }
      : null,
  }
}

export type SiteProps = NonNullable<Awaited<ReturnType<typeof loadSiteProps>>>

/**
 * The blocks a site shows, from its block rows (the live ones, or a saved
 * version's for its preview). The default layout only for a site never laid
 * out (no block rows), so a new property is not blank. Blocks the hotel
 * turned off stay off, all of them included: an empty choice is not
 * "everything" (it used to bring back the full default layout).
 */
export function siteBlocks<T extends { isEnabled: boolean; type?: string }>(rows: T[], propertyType: string) {
  if (rows.length === 0) return defaultBlocksForProperty(propertyType)
  const enabled = rows.filter((b) => b.isEnabled)
  // Ensure AMENITIES is not accidentally lost if an existing property had saved blocks before AMENITIES was supported
  if (!rows.some((b: any) => b.type === 'AMENITIES')) {
    const defaultAmenityBlock = {
      id: 'default-amenities',
      type: 'AMENITIES',
      name: 'Tiện ích',
      config: { title: 'Tiện ích khách sạn' },
      isEnabled: true,
      sortOrder: 2.5,
    } as unknown as T
    const roomsIdx = enabled.findIndex((b: any) => b.type === 'ROOMS')
    if (roomsIdx >= 0) {
      enabled.splice(roomsIdx + 1, 0, defaultAmenityBlock)
    } else {
      enabled.push(defaultAmenityBlock)
    }
  }
  return enabled
}

/**
 * The site in the visitor's language (outside the cache, which holds both):
 * the hotel's English texts where it wrote them (src/lib/i18n/content.ts),
 * amenity names from `amenityName(slug, name)` (the shared amenities have
 * Vietnamese names; their English ones are in messages, site.amenityNames).
 */
export function localizeSiteProps(site: SiteProps, locale: Locale, amenityName: (slug: string, name: string) => string): SiteProps {
  if (locale !== 'en') return site
  return {
    ...site,
    property: localizeRow(site.property, ['description'], locale),
    amenities: site.amenities.map((a) => ({ ...a, name: a.customName ? a.customName : amenityName(a.slug, a.name) })),
    roomTypes: site.roomTypes.map((rt) => ({
      ...localizeRow(rt, ['name', 'description'], locale),
      amenities: rt.amenities.map((name, i) => amenityName(rt.amenitySlugs?.[i], name)),
    })),
    services: site.services.map((s) => localizeRow(s, ['name', 'description'], locale)),
    menuItems: localizeMenuItems(site.menuItems, locale),
    settings: site.settings && localizeRow(site.settings, ['metaTitle', 'metaDescription'], locale),
  }
}

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
