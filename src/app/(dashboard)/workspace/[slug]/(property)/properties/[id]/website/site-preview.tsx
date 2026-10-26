'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { EyeOff, Mail, MapPin, MessageCircle, Phone, Star } from 'lucide-react'
import { getIcon } from '@/lib/amenity-icons'
import { useDashLabels } from '@/lib/i18n/dash'
import { resizedImage } from '@/lib/media/image-url'
import { cn } from '@/lib/utils'
import { formatAddress } from '@/lib/vn-admin/address'

/**
 * What the hotel's site shows, as GET /api/website/blocks returns it
 * (loadSiteProps in src/lib/public-site/site.ts): the real rooms with the
 * site's prices, photos, amenities, services and dishes.
 */
export interface PreviewSite {
  property: {
    id: string
    name: string
    type: string
    description: string | null
    address: string
    city: string
    ward?: string | null
    district: string | null
    country: string
    phone: string | null
    email: string | null
    coverImage: string | null
  }
  images: { url: string; thumbnail: string | null; alt: string | null }[]
  amenities: { id: string; name: string; icon: string | null }[]
  roomTypes: {
    id: string
    name: string
    area: number | null
    maxAdults: number
    maxChildren: number
    image: string | null
    fromPrice: number | null
    amenities: string[]
  }[]
  services: { id: string; name: string; description: string | null; price: number; priceType: string; perPerson: boolean }[]
  menuItems: { id: string; name: string; price: number }[]
  /** The default layout the site renders while no block is saved (empty once there are). */
  defaultBlocks: { id: string; type: string; name: string; config: Record<string, unknown> | null }[]
}

export interface PreviewBlockData {
  type: string
  config: object | null
}

/** The first non-empty text among `keys` (the builder saves heroTitle..., the default layout title). */
function text(cfg: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = cfg[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/**
 * One block of the hotel's site, drawn as src/app/(public)/[subdomain]/
 * _components/blocks draw it (same texts, defaults and conditions), smaller,
 * with the property's real data. A block the site would leave out says so
 * instead of showing sample content.
 */
export function PreviewBlock({ block, site, compact }: { block: PreviewBlockData; site: PreviewSite; compact: boolean }) {
  const t = useTranslations('dash.website.preview')
  const tTypes = useTranslations('dash.property.types')
  const labels = useDashLabels()
  const cfg = (block.config ?? {}) as Record<string, unknown>
  const { property, images } = site
  const wide = !compact

  switch (block.type) {
    case 'HERO': {
      // The builder's old default title stopped at "Chào mừng đến với": the hotel's name instead (HeroBlock).
      const typed = text(cfg, 'heroTitle', 'title')
      const title = typed && typed !== 'Chào mừng đến với' ? typed : property.name
      const subtitle = text(cfg, 'heroSubtitle', 'subtitle') ?? property.description ?? t('heroWelcome', { name: property.name })
      const photos = Array.from(
        new Set([text(cfg, 'backgroundImage'), property.coverImage, ...images.map((i) => i.url)].filter((u): u is string => !!u))
      ).slice(0, wide ? 4 : 2)
      const typeLabel = tTypes.has(property.type as 'HOTEL') ? tTypes(property.type as 'HOTEL') : property.type
      return (
        <section className="px-5 pt-8 pb-8 sm:px-8">
          <Eyebrow>
            {typeLabel} · {property.city}
          </Eyebrow>
          <h2 className={cn('font-site text-fg text-[34px] leading-[42px]', wide && 'sm:text-[44px] sm:leading-[52px]')}>{title}</h2>
          <p className="mt-3 text-body text-muted">{subtitle}</p>
          {photos.length > 0 && (
            <div className={cn('mt-6 grid grid-cols-2 gap-2', wide && 'sm:grid-cols-4')}>
              {photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={resizedImage(url, 480)} alt="" className="aspect-[3/4] w-full object-cover" />
              ))}
            </div>
          )}
          {cfg.showSearchBar !== false && (
            <div
              aria-hidden="true"
              className={cn(
                'relative z-10 grid grid-cols-2 gap-3 border border-line bg-panel p-3 text-small shadow-sm',
                photos.length > 0 ? '-mt-6 mx-3' : 'mt-6',
                wide && 'sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center'
              )}
            >
              {[t('searchCheckIn'), t('searchCheckOut'), t('searchGuests')].map((label) => (
                <span key={label} className="border-b border-line pb-1 text-muted">
                  {label}
                </span>
              ))}
              <span className="inline-flex h-9 items-center justify-center rounded-ctl bg-ink px-4 font-medium text-on-ink">{t('searchButton')}</span>
            </div>
          )}
        </section>
      )
    }

    case 'ROOMS': {
      const title = text(cfg, 'roomsTitle', 'title') ?? t('roomsTitle')
      const limit = Number(cfg.roomsLimit) > 0 ? Number(cfg.roomsLimit) : undefined
      const rooms = site.roomTypes.slice(0, limit)
      const showPrice = cfg.showPrice !== false
      const showCTA = cfg.showCTA !== false
      return (
        <PreviewSection>
          <SectionTitle>{title}</SectionTitle>
          {rooms.length > 0 && <p className="mt-2 text-small text-muted">{t('roomsCount', { count: site.roomTypes.length, name: property.name })}</p>}
          {rooms.length === 0 ? (
            <p className="mt-5 text-body text-muted">{t('roomsEmpty', { name: property.name })}</p>
          ) : (
            <ul className={cn('mt-6 grid gap-4', wide && 'sm:grid-cols-2')}>
              {rooms.map((room) => (
                <li key={room.id} className="flex flex-col overflow-hidden rounded-box border border-line bg-panel">
                  {room.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resizedImage(room.image, 480)} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="relative aspect-[4/3] w-full bg-fg/[0.06]">
                      <span className="absolute bottom-2 left-2 bg-panel/90 px-2 py-0.5 font-mono text-[11px] text-muted">{t('noPhoto')}</span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-body font-semibold text-fg">{room.name}</p>
                      {showPrice && room.fromPrice != null && room.fromPrice > 0 && (
                        <p className="shrink-0 text-right text-body font-semibold tabular-nums text-fg">
                          {labels.money(room.fromPrice)}
                          <span className="text-xs font-normal text-muted">{t('perNight')}</span>
                        </p>
                      )}
                    </div>
                    <p className="mt-1 text-small text-muted">
                      {[room.area ? t('area', { area: room.area }) : null, labels.guests(room.maxAdults, room.maxChildren)].filter(Boolean).join(' · ')}
                    </p>
                    {room.amenities.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {room.amenities.slice(0, 3).map((name) => (
                          <li key={name} className="rounded-ctl bg-fg/5 px-2 py-0.5 text-xs text-fg">
                            {name}
                          </li>
                        ))}
                        {room.amenities.length > 3 && <li className="px-1 py-0.5 text-xs text-muted">{t('moreAmenities', { count: room.amenities.length - 3 })}</li>}
                      </ul>
                    )}
                    {showCTA && (
                      <div className="mt-auto pt-4">
                        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                          <span className="text-small font-medium text-acc">{t('details')}</span>
                          <span className="inline-flex h-9 items-center rounded-ctl bg-ink px-3 text-small font-medium text-on-ink">{t('bookNow')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PreviewSection>
      )
    }

    case 'AMENITIES': {
      const title = text(cfg, 'amenitiesTitle', 'title') ?? t('amenitiesTitle')
      const photo = images[2] ?? images[1] ?? images[0]
      return (
        <PreviewSection className="bg-fg/[0.02]">
          <div className={cn(photo && wide && 'grid gap-6 sm:grid-cols-[1fr_200px]')}>
            <div>
              <Eyebrow>{t('amenitiesEyebrow')}</Eyebrow>
              <SectionTitle>{title}</SectionTitle>
              {site.amenities.length === 0 ? (
                <p className="mt-5 text-body text-muted">{t('amenitiesEmpty')}</p>
              ) : (
                <ul className={cn('mt-5 border-t border-line', wide && !photo && 'sm:grid sm:grid-cols-2 sm:gap-x-8')}>
                  {site.amenities.map((amenity) => {
                    const Icon = getIcon(amenity.icon)
                    return (
                      <li key={amenity.id} className="flex items-center gap-3 border-b border-line py-3 text-small text-fg">
                        <Icon className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                        {amenity.name}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {photo && wide && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resizedImage(photo.url, 480)} alt="" className="hidden h-full min-h-[200px] w-full object-cover sm:block" />
            )}
          </div>
        </PreviewSection>
      )
    }

    case 'ABOUT': {
      const description = text(cfg, 'aboutContent', 'description') ?? property.description
      if (!description) return <HiddenOnSite>{t('hidden.about')}</HiddenOnSite>
      return (
        <PreviewSection>
          <Eyebrow>{t('aboutEyebrow')}</Eyebrow>
          <SectionTitle>{text(cfg, 'aboutTitle', 'title') ?? t('aboutTitle')}</SectionTitle>
          <p className="mt-4 whitespace-pre-line text-body text-muted">{description}</p>
        </PreviewSection>
      )
    }

    case 'GALLERY': {
      if (images.length === 0) return <HiddenOnSite>{t('hidden.gallery')}</HiddenOnSite>
      return (
        <PreviewSection>
          <Eyebrow>{t('galleryEyebrow')}</Eyebrow>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <SectionTitle>{text(cfg, 'galleryTitle', 'title') ?? t('galleryTitle')}</SectionTitle>
            <p className="text-small text-muted">{t('galleryCount', { count: images.length })}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resizedImage(images[0].url, 800)} alt="" className="mt-5 h-48 w-full object-cover sm:h-64" />
          {images.length > 1 && (
            <div className={cn('mt-2 grid grid-cols-4 gap-2', wide && 'sm:grid-cols-6')}>
              {images.slice(0, 6).map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={resizedImage(img.thumbnail ?? img.url, 480)} alt="" className={cn('h-14 w-full object-cover', i > 0 && 'opacity-70')} />
              ))}
            </div>
          )}
        </PreviewSection>
      )
    }

    case 'REVIEWS': {
      // The hotel's own reviews (ReviewsBlock); none: the site leaves the block out.
      const raw = Array.isArray(cfg.reviews) ? (cfg.reviews as Record<string, unknown>[]) : []
      const limit = Number(cfg.reviewsLimit) > 0 ? Number(cfg.reviewsLimit) : 6
      const reviews = raw
        .map((r) => ({
          name: typeof r?.name === 'string' ? r.name.trim() : '',
          source: typeof r?.source === 'string' ? r.source.trim() : '',
          text: typeof r?.text === 'string' ? r.text.trim() : '',
          rating: Math.min(5, Math.max(1, Math.round(Number(r?.rating)) || 5)),
        }))
        .filter((r) => r.name && r.text)
        .slice(0, limit)
      if (reviews.length === 0) return <HiddenOnSite>{t('reviews.none')}</HiddenOnSite>
      return (
        <PreviewSection>
          <Eyebrow>{t('reviewsEyebrow')}</Eyebrow>
          <SectionTitle>{text(cfg, 'reviewsTitle', 'title') ?? t('reviewsTitle')}</SectionTitle>
          <ul className={cn('mt-5 grid gap-3', wide && 'sm:grid-cols-2')}>
            {reviews.map((review, i) => (
              <li key={i} className="border border-line bg-panel p-4">
                <p className="flex gap-0.5 text-acc" aria-label={t('stars', { rating: review.rating })}>
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  ))}
                </p>
                <p className="mt-3 text-small text-fg">“{review.text}”</p>
                <p className="mt-3 text-xs text-muted">
                  {review.name}
                  {review.source && <span> · {review.source}</span>}
                </p>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )
    }

    case 'MAP': {
      const fullAddress =
        text(cfg, 'mapAddress') ?? formatAddress(property, { country: true })
      // The default layout titles this block "Vị trí", which is already the eyebrow (MapBlock).
      const custom = text(cfg, 'title')
      const title = custom && custom.toLowerCase() !== 'vị trí' ? custom : formatAddress(property)
      return (
        <PreviewSection>
          <Eyebrow>{t('mapEyebrow')}</Eyebrow>
          <SectionTitle>{title}</SectionTitle>
          <div className={cn('mt-5 grid gap-5', wide && 'sm:grid-cols-[1fr_220px]')}>
            <div className="flex h-40 items-center justify-center border border-line bg-fg/[0.04] text-muted">
              <MapPin className="h-6 w-6 text-acc" aria-hidden="true" />
            </div>
            <dl className="border-t border-line text-small">
              <div className="flex justify-between gap-3 border-b border-line py-3">
                <dt className="text-fg">{t('address')}</dt>
                <dd className="text-right text-muted">{fullAddress}</dd>
              </div>
              {property.phone && (
                <div className="flex justify-between gap-3 border-b border-line py-3">
                  <dt className="text-fg">{t('phone')}</dt>
                  <dd className="tabular-nums text-muted">{property.phone}</dd>
                </div>
              )}
            </dl>
          </div>
        </PreviewSection>
      )
    }

    case 'CONTACT': {
      const phone = text(cfg, 'contactPhone') ?? property.phone
      const email = text(cfg, 'contactEmail') ?? property.email
      const address = text(cfg, 'contactAddress') ?? formatAddress(property)
      const rows = [
        phone && { icon: Phone, label: t('phone'), value: phone, href: tel(phone) },
        email && { icon: Mail, label: 'Email', value: email },
        phone && { icon: MessageCircle, label: 'Zalo', value: t('zalo') },
        address && { icon: MapPin, label: t('address'), value: address },
      ].filter(Boolean) as { icon: typeof Phone; label: string; value: string }[]
      return (
        <PreviewSection>
          <Eyebrow>{t('contactEyebrow')}</Eyebrow>
          <SectionTitle>{text(cfg, 'contactTitle', 'title') ?? t('contactTitle')}</SectionTitle>
          <p className="mt-3 text-small text-muted">{t('contactIntro')}</p>
          <ul className="mt-5 border-t border-line">
            {rows.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-center gap-3 border-b border-line py-3">
                <Icon className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                <span className="w-20 shrink-0 text-small text-muted">{label}</span>
                <span className="min-w-0 break-words text-small text-fg">{value}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )
    }

    case 'SERVICES': {
      if (site.services.length === 0) return <HiddenOnSite>{t('hidden.services')}</HiddenOnSite>
      const unit = (type: string, perPerson: boolean) => {
        const base = type === 'PER_NIGHT' ? t('perNight') : type === 'PER_PERSON' ? t('perPerson') : t('once')
        return perPerson && type !== 'PER_PERSON' ? `${base} ${t('perPerson')}` : base
      }
      return (
        <PreviewSection>
          <Eyebrow>{t('servicesEyebrow')}</Eyebrow>
          <SectionTitle>{text(cfg, 'servicesTitle', 'title') ?? t('servicesTitle')}</SectionTitle>
          <ul className={cn('mt-5 border-t border-line', wide && 'sm:grid sm:grid-cols-2 sm:gap-x-8')}>
            {site.services.map((service) => (
              <li key={service.id} className="flex items-start justify-between gap-3 border-b border-line py-3">
                <div className="min-w-0">
                  <p className="text-small font-medium text-fg">{service.name}</p>
                  {service.description && <p className="mt-0.5 text-xs text-muted">{service.description}</p>}
                </div>
                <p className="shrink-0 text-right text-small font-semibold tabular-nums text-fg">
                  {service.price > 0 ? labels.money(service.price) : t('free')}
                  {service.price > 0 && <span className="block text-xs font-normal text-muted">{unit(service.priceType, service.perPerson)}</span>}
                </p>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )
    }

    case 'RESTAURANT_MENU': {
      if (site.menuItems.length === 0) return <HiddenOnSite>{t('hidden.menu')}</HiddenOnSite>
      const shown = site.menuItems.slice(0, 6)
      return (
        <PreviewSection>
          <Eyebrow>{t('menuEyebrow')}</Eyebrow>
          <SectionTitle>{text(cfg, 'menuTitle', 'title') ?? t('menuTitle')}</SectionTitle>
          {text(cfg, 'menuNote', 'contactNote') && <p className="mt-3 text-small text-muted">{text(cfg, 'menuNote', 'contactNote')}</p>}
          <ul className={cn('mt-5 border-t border-line', wide && 'sm:grid sm:grid-cols-2 sm:gap-x-8')}>
            {shown.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 border-b border-line py-3">
                <p className="min-w-0 text-small font-medium text-fg">{item.name}</p>
                <p className="shrink-0 text-small font-semibold tabular-nums text-fg">{item.price > 0 ? labels.money(item.price) : t('free')}</p>
              </li>
            ))}
          </ul>
          {site.menuItems.length > shown.length && (
            <p className="mt-3 text-xs text-muted">{t('moreDishes', { count: site.menuItems.length - shown.length })}</p>
          )}
        </PreviewSection>
      )
    }

    case 'CTA': {
      // A dark band on the light page; a raised one in the dark theme (CtaBlock).
      const subtitle = text(cfg, 'ctaSubtitle', 'subtitle')
      return (
        <section data-band className="bg-ink px-6 py-10 text-center text-on-ink dark:bg-raised dark:text-fg">
          <h2 className="font-site text-[28px] leading-9">{text(cfg, 'ctaTitle', 'title') ?? t('ctaTitle')}</h2>
          {subtitle && <p className="mt-3 text-body text-on-ink/80 dark:text-muted">{subtitle}</p>}
          <span className="mt-6 inline-flex h-11 items-center rounded-ctl bg-page px-5 text-small font-medium text-fg dark:bg-ink dark:text-on-ink">
            {text(cfg, 'ctaButtonText', 'buttonText') ?? t('ctaButton')}
          </span>
        </section>
      )
    }

    case 'FOOTER': {
      const address = formatAddress(property)
      return (
        <footer className="border-t border-line px-5 pt-8 pb-6 sm:px-8">
          <div className={cn('grid gap-6', wide && 'sm:grid-cols-[1.4fr_1fr]')}>
            <div>
              <p className="font-site text-[24px] leading-8 text-fg">{property.name}</p>
              <p className="mt-2 text-small text-muted">{address}</p>
            </div>
            <div>
              <p className="text-label uppercase text-muted">{t('footerContact')}</p>
              <ul className="mt-3 space-y-1.5 text-small text-fg">
                {property.phone && <li>{property.phone}</li>}
                {property.email && <li className="break-all">{property.email}</li>}
              </ul>
            </div>
          </div>
          <p className="mt-8 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted">
            {t('poweredBy')}
            <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" aria-hidden="true" />
              Digistay
            </span>
          </p>
        </footer>
      )
    }

    default:
      return null
  }
}

/** The menu entries, as the site builds them (PropertySite: blocks with a section, and something to show). */
const SECTIONS = [
  ['ROOMS', 'rooms'],
  ['AMENITIES', 'amenities'],
  ['GALLERY', 'gallery'],
  ['SERVICES', 'services'],
  ['RESTAURANT_MENU', 'menu'],
  ['MAP', 'map'],
  ['CONTACT', 'contact'],
] as const

/** The site's header (SiteHeader): the hotel's name, its section menu, the phone and "Đặt phòng". */
export function PreviewHeader({ site, types, compact }: { site: PreviewSite; types: string[]; compact: boolean }) {
  const t = useTranslations('dash.website.preview')
  const tTypes = useTranslations('dash.property.types')
  const { property } = site
  const sections = SECTIONS.filter(
    ([type]) =>
      types.includes(type) &&
      !(type === 'GALLERY' && site.images.length === 0) &&
      !(type === 'RESTAURANT_MENU' && site.menuItems.length === 0) &&
      !(type === 'SERVICES' && site.services.length === 0)
  )
  const typeLabel = tTypes.has(property.type as 'HOTEL') ? tTypes(property.type as 'HOTEL') : property.type
  return (
    <div className="flex h-16 items-center gap-4 border-b border-line bg-page/95 px-5 sm:px-8">
      <div className="min-w-0 shrink">
        <p className="truncate font-site text-[20px] leading-tight text-fg">{property.name}</p>
        <p className="truncate text-[10px] uppercase tracking-[0.18em] text-muted">
          {typeLabel} · {property.city}
        </p>
      </div>
      {!compact && sections.length > 0 && (
        <nav aria-hidden="true" className="hidden flex-1 justify-center gap-5 2xl:flex">
          {sections.map(([, id]) => (
            <span key={id} className="text-small text-fg">
              {t(`sections.${id}`)}
            </span>
          ))}
        </nav>
      )}
      <span className="ml-auto inline-flex h-9 shrink-0 items-center rounded-ctl bg-ink px-4 text-small font-medium text-on-ink">{t('book')}</span>
    </div>
  )
}

function PreviewSection({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('px-5 py-8 sm:px-8 sm:py-10', className)}>{children}</section>
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-label uppercase text-acc">{children}</p>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-site text-[26px] leading-[34px] text-fg sm:text-[30px] sm:leading-[38px]">{children}</h2>
}

/** A block the site leaves out (nothing to show yet): said in the builder, never filled with samples. */
function HiddenOnSite({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-4 flex items-start gap-3 rounded-box border border-dashed border-line p-4 text-small text-muted">
      <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
