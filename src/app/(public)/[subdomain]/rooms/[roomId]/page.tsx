import { cache } from 'react'
import type { Metadata } from 'next'
import { ratesFrom } from '@/lib/pricing/quote'
import { ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/db'
import { isLocale, type Locale } from '@/i18n/locales'
import { amenityName } from '@/lib/i18n/amenities'
import { localizeRow } from '@/lib/i18n/content'
import { JsonLd } from '@/components/seo/JsonLd'
import { SiteHeader, type SiteSection } from '../../_components/SiteHeader'
import { SiteLink } from '../../_components/site-base'
import { Container, bedLabel, roomMeta } from '../../_components/site-ui'
import { getIcon } from '@/lib/amenity-icons'
import { formatVnd } from '@/lib/bookings/display'
import { responsiveImage } from '@/lib/media/image-url'
import { BookingBox } from './BookingBox'
import { loadSiteFrame } from '@/lib/public-site/site-frame'
import { canonicalSiteOrigin } from '@/lib/public-site/site-host'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { hotelRoomJsonLd } from '@/lib/seo/hotel-schema'
import { hotelPageMetadata } from '@/lib/seo/page-metadata'
import { roomPath, sitePageUrl } from '@/lib/seo/urls'

interface PageProps {
  params: Promise<{ subdomain: string; roomId: string }>
  searchParams: Promise<{ checkIn?: string; checkOut?: string; adults?: string; children?: string }>
}

export const dynamic = 'force-dynamic'

const SECTIONS: Record<string, SiteSection> = {
  ROOMS: { id: 'rooms' },
  AMENITIES: { id: 'amenities' },
  MAP: { id: 'map' },
  CONTACT: { id: 'contact' },
}

const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
const guests = (v: string | undefined) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? n : undefined
}

/** The hotel and the room type (active only), once per request for the metadata and the page. */
const loadRoomPage = cache(async (propertyId: string, roomId: string) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      phone: true,
      coverImage: true,
      policy: true,
      websiteBlocks: { where: { isEnabled: true }, select: { type: true } },
      roomTypes: {
        where: { id: roomId, isActive: true },
        include: {
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          // The room type's own price, the one bookings are charged.
          ...ROOM_RATE_INCLUDE,
          amenities: { include: { amenity: true } },
        },
      },
    },
  })
  return property && property.roomTypes.length > 0 ? property : null
})

const pageLocale = async (): Promise<Locale> => {
  const locale = await getLocale()
  return isLocale(locale) ? locale : 'vi'
}

/** "<room> · <hotel>", its description (or its size, bed and guests), its first photo, canonical URL. */
export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { subdomain, roomId } = await params
  const site = await loadVisibleSite(subdomain)
  if (!site) return {}
  const [property, frame] = await Promise.all([loadRoomPage(site.propertyId, roomId), loadSiteFrame(subdomain)])
  if (!property) return {}
  const lang = await pageLocale()
  const t = await getTranslations('site')
  const room = localizeRow(property.roomTypes[0], ['name', 'description'], lang)
  const about = room.description?.replace(/\s+/g, ' ').trim()
  const description = about ? (about.length > 200 ? `${about.slice(0, 197).trimEnd()}…` : about) : roomMeta(room, t)
  return {
    title: room.name,
    description,
    ...hotelPageMetadata({
      origin: canonicalSiteOrigin(subdomain, frame?.websiteSettings),
      locale: lang,
      path: roomPath(room.id),
      siteName: property.name,
      title: `${room.name} · ${property.name}`,
      description,
      images: [...room.images.map((i) => i.url), property.coverImage],
    }),
  }
}

/** A room type's page (redesign 2c). */
export default async function RoomDetailPage({ params, searchParams }: PageProps) {
  const { subdomain, roomId } = await params
  const query = await searchParams
  const t = await getTranslations('site')
  const locale = await getLocale()

  const site = await loadVisibleSite(subdomain)
  if (!site) notFound()

  const [property, frame] = await Promise.all([loadRoomPage(site.propertyId, roomId), loadSiteFrame(subdomain)])
  if (!property) notFound()

  // The hotel's English texts when the visitor reads English (src/lib/i18n/content.ts).
  const lang = isLocale(locale) ? locale : 'vi'
  const room = localizeRow(property.roomTypes[0], ['name', 'description'], lang)
  // The rates a booking is charged (src/lib/pricing/quote.ts); null: no price yet.
  const rates = ratesFrom(room.pricing[0], await propertyRateDefaults(prisma, property.id))
  const origin = canonicalSiteOrigin(subdomain, frame?.websiteSettings)
  const structured = hotelRoomJsonLd({
    url: sitePageUrl(origin, lang, roomPath(room.id)),
    locale: lang,
    hotel: { id: `${origin}/#hotel`, type: property.type, name: property.name, url: sitePageUrl(origin, lang, '/') },
    name: room.name,
    description: room.description,
    images: room.images.map((i) => i.url),
    area: room.area,
    bed: bedLabel(room.bedType, t),
    maxAdults: room.maxAdults,
    maxChildren: room.maxChildren,
    amenities: room.amenities.map(({ amenity }) => amenityName(amenity.slug, amenity.name, lang)),
    rates,
  })
  const blockTypes = new Set(property.websiteBlocks.map((b) => b.type))
  const sections = Object.entries(SECTIONS)
    .filter(([type]) => blockTypes.size === 0 || blockTypes.has(type as never))
    .map(([, s]) => s)
  const policy = property.policy && localizeRow(property.policy, ['cancellationPolicy', 'additionalRules'], lang)
  const photos = room.images

  const specs = [
    { label: t('room.area'), value: room.area ? t('units.area', { area: room.area }) : '—' },
    { label: t('room.bedType'), value: bedLabel(room.bedType, t) },
    { label: t('room.maxAdults'), value: String(room.maxAdults) },
    { label: t('room.maxChildren'), value: String(room.maxChildren) },
  ]

  const policies: { title: string; text: string }[] = []
  if (policy) {
    policies.push({
      title: t('policy.checkInOut'),
      text: t('policy.checkInOutText', { checkIn: policy.checkInTime, checkOut: policy.checkOutTime }),
    })
    if (policy.cancellationHours != null || policy.cancellationPolicy) {
      policies.push({
        title: t('policy.cancellation'),
        text: [
          policy.cancellationHours != null ? t('policy.freeCancellation', { hours: policy.cancellationHours }) : null,
          policy.cancellationPolicy,
        ]
          .filter(Boolean)
          .join(' '),
      })
    }
    policies.push({
      title: t('policy.children'),
      text: policy.childrenAllowed
        ? policy.minChildAge > 0
          ? t('policy.childrenFromAge', { age: policy.minChildAge })
          : t('policy.childrenAnyAge')
        : t('policy.noChildren'),
    })
    policies.push({
      title: t('policy.petsSmoking'),
      text: `${policy.petsAllowed ? t('policy.petsAllowed') : t('policy.noPets')} ${policy.smokingAllowed ? t('policy.smokingArea') : t('policy.noSmoking')}`,
    })
    if (policy.additionalRules) policies.push({ title: t('policy.otherRules'), text: policy.additionalRules })
  }

  return (
    <>
      <JsonLd data={structured} />
      <SiteHeader property={property} sections={sections} onHome={false} />

      <main className="pb-28 lg:pb-24">
        <Container className="pt-6 sm:pt-10">
          <nav aria-label={t('nav.breadcrumb')} className="text-small">
            <SiteLink path="/" className="text-acc hover:underline">
              {t('nav.home')}
            </SiteLink>
            <span className="text-muted"> / </span>
            <SiteLink path="/#rooms" className="text-acc hover:underline">
              {t('nav.rooms')}
            </SiteLink>
            <span className="text-muted"> / </span>
            <span className="text-fg">{room.name}</span>
          </nav>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="font-site text-[40px] leading-[48px] sm:text-h1 text-fg">{room.name}</h1>
            <p className="text-small text-muted lg:pb-2">{roomMeta(room, t)}</p>
          </div>

          {photos.length > 0 && (
            <div className="mt-8 grid gap-2 lg:grid-cols-[2fr_1fr_1fr] lg:grid-rows-2">
              {photos.slice(0, 5).map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  {...responsiveImage(img.url, i === 0 ? '(min-width: 1024px) 50vw, 100vw' : '25vw', { fallback: i === 0 ? 1200 : 800 })}
                  alt={img.alt || t('room.photoAlt', { name: room.name, n: i + 1 })}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className={
                    i === 0
                      ? 'h-[280px] w-full object-cover sm:h-[420px] lg:row-span-2 lg:h-[528px]'
                      : 'hidden h-[260px] w-full object-cover lg:block'
                  }
                />
              ))}
            </div>
          )}

          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-16">
            <div className="space-y-12">
              {room.description && <p className="max-w-2xl text-lead text-fg whitespace-pre-line">{room.description}</p>}

              <section>
                <h2 className="font-site text-h3 text-fg">{t('room.specs')}</h2>
                <dl className="mt-5 grid grid-cols-2 border-y border-line sm:grid-cols-4">
                  {specs.map((s, i) => (
                    <div key={s.label} className={`py-5 pr-4 ${i > 0 ? 'sm:border-l sm:border-line sm:pl-5' : ''} ${i % 2 === 1 ? 'border-l border-line pl-5 sm:pl-5' : ''}`}>
                      <dt className="text-label uppercase text-muted">{s.label}</dt>
                      <dd className="mt-1 text-body text-fg">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {room.amenities.length > 0 && (
                <section>
                  <h2 className="font-site text-h3 text-fg">{t('room.amenities')}</h2>
                  <ul className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                    {room.amenities.map(({ amenity }) => {
                      const Icon = getIcon(amenity.icon)
                      return (
                        <li key={amenity.id} className="flex items-center gap-3 border-b border-line py-3 text-body text-fg">
                          <Icon className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                          {amenityName(amenity.slug, amenity.name, lang)}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {policies.length > 0 && (
                <section>
                  <h2 className="font-site text-h3 text-fg">{t('room.policies')}</h2>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {policies.map((p) => (
                      <li key={p.title} className="border border-line bg-panel p-5">
                        <h3 className="text-body font-medium text-fg">{p.title}</h3>
                        <p className="mt-1 text-small text-muted whitespace-pre-line">{p.text}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <BookingBox
                rates={rates}
                baseOccupancy={room.baseOccupancy}
                maxAdults={room.maxAdults}
                maxChildren={room.maxChildren}
                checkIn={day(query.checkIn)}
                checkOut={day(query.checkOut)}
                adults={guests(query.adults)}
                childGuests={guests(query.children)}
              />
            </aside>
          </div>
        </Container>
      </main>

      {/* Phones: the price and the button stay at the bottom (redesign 2c mobile). */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-line bg-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <p className="text-body font-semibold tabular-nums text-fg">
          {rates ? (
            <>
              {formatVnd(rates.weekdayPrice, locale)}
              <span className="text-xs font-normal text-muted"> {t('units.perNight')}</span>
            </>
          ) : (
            t('room.contactForPrice')
          )}
        </p>
        <a href="#dat-phong" className="inline-flex h-11 items-center rounded-ctl bg-ink px-6 text-small font-medium text-on-ink">
          {t('bookingBox.book')}
        </a>
      </div>
    </>
  )
}
