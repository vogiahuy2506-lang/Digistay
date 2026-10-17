import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { PropertySite } from './_components/PropertySite'

interface PageProps {
  params: Promise<{ subdomain: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicPropertyPage({ params }: PageProps) {
  const { subdomain } = await params

  // Lookup property by subdomain (path param — real wildcard subdomain routing
  // is handled in middleware.ts; this fallback lets /[subdomain] URLs work
  // during local dev without DNS).
  const property = await prisma.property.findFirst({
    where: {
      subdomain,
      isActive: true,
    },
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

  if (!property) {
    notFound()
  }

  // Fall back to a "default" block layout when the property has none yet
  // so the public site is never blank for a freshly created property.
  const blocks =
    property.websiteBlocks.length > 0
      ? property.websiteBlocks
      : defaultBlocksForProperty(property.type)

  return (
    <PropertySite
      property={{
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
      }}
      images={property.images.map((i) => ({
        url: i.url,
        thumbnail: i.thumbnail,
        alt: i.alt,
      }))}
      amenities={property.amenities.map((pa) => ({
        id: pa.amenity.id,
        name: pa.amenity.name,
        icon: pa.amenity.icon,
        category: pa.amenity.category,
      }))}
      roomTypes={property.roomTypes.map((rt) => ({
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
      }))}
      services={property.extraServices.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price: s.price,
        priceType: s.priceType,
        perPerson: s.perPerson,
      }))}
      blocks={blocks.map((b) => ({
        id: b.id,
        type: b.type,
        name: b.name,
        config: b.config as Record<string, any>,
      }))}
      settings={
        property.websiteSettings
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
          : null
      }
    />
  )
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
