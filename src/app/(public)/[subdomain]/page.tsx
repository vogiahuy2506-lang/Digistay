import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/JsonLd'
import { prisma } from '@/lib/db'
import { amenityName } from '@/lib/i18n/amenities'
import { isLocale, type Locale } from '@/i18n/locales'
import { getPublicSiteProps, localizeSiteProps } from '@/lib/public-site/site'
import { loadSiteFrame, siteSeoTexts } from '@/lib/public-site/site-frame'
import { canonicalSiteOrigin } from '@/lib/public-site/site-host'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { hotelJsonLd } from '@/lib/seo/hotel-schema'
import { hotelPageMetadata } from '@/lib/seo/page-metadata'
import { sitePageUrl } from '@/lib/seo/urls'
import { PropertySite } from './_components/PropertySite'

interface PageProps {
  params: Promise<{ subdomain: string }>
}

// Rendered per request; the heavy part (what the site shows) is cached per
// property and dropped on every edit (src/lib/public-site/site.ts).
export const dynamic = 'force-dynamic'

/** Once per request for the metadata and the page. */
const siteProps = cache((propertyId: string) => getPublicSiteProps(propertyId))

const pageLocale = async (): Promise<Locale> => {
  const current = await getLocale()
  return isLocale(current) ? current : 'vi'
}

/** Canonical URL, vi / en alternates and the share card (title, description, cover photo). */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { subdomain } = await params
  const visible = await loadVisibleSite(subdomain)
  if (!visible) return {}
  const [frame, site] = await Promise.all([loadSiteFrame(subdomain), siteProps(visible.propertyId)])
  if (!frame || !site) return {}
  const locale = await pageLocale()
  const { title, description } = siteSeoTexts(frame, locale)
  return hotelPageMetadata({
    origin: canonicalSiteOrigin(subdomain, frame.websiteSettings),
    locale,
    path: '/',
    siteName: frame.name,
    title,
    description,
    images: [site.property.coverImage, ...site.images.map((i) => i.url)],
  })
}

export default async function PublicPropertyPage({ params }: PageProps) {
  const { subdomain } = await params

  // Lookup property by subdomain (path param — real wildcard subdomain routing
  // is handled in src/middleware.ts). Not cached: a deactivated, unpublished
  // hotel or a changed subdomain applies at once (src/lib/public-site/visibility.ts).
  const visible = await loadVisibleSite(subdomain)
  if (!visible) notFound()

  const [cached, frame, policy] = await Promise.all([
    siteProps(visible.propertyId),
    loadSiteFrame(subdomain),
    // Check-in / check-out times for the structured data; no policy, none claimed.
    prisma.policy.findUnique({ where: { propertyId: visible.propertyId }, select: { checkInTime: true, checkOutTime: true } }),
  ])
  if (!cached) notFound()

  const locale = await pageLocale()
  const site = localizeSiteProps(cached, locale, (slug, name) => amenityName(slug, name, locale))
  const origin = canonicalSiteOrigin(subdomain, frame?.websiteSettings)
  const p = site.property
  const hotel = hotelJsonLd({
    id: `${origin}/#hotel`,
    url: sitePageUrl(origin, locale, '/'),
    locale,
    type: p.type,
    name: p.name,
    description: p.description || (frame && siteSeoTexts(frame, locale).description),
    phone: p.phone,
    email: p.email,
    address: p.address,
    ward: p.ward,
    district: p.district,
    city: p.city,
    country: p.country,
    latitude: p.latitude,
    longitude: p.longitude,
    logo: p.logo,
    images: [p.coverImage, ...site.images.map((i) => i.url)],
    checkInTime: policy?.checkInTime,
    checkOutTime: policy?.checkOutTime,
    amenities: site.amenities.map((a) => a.name),
    prices: site.roomTypes.flatMap((r) => [r.fromPrice, r.weekendPrice]),
  })

  return (
    <>
      <JsonLd data={hotel} />
      <PropertySite {...site} />
    </>
  )
}
