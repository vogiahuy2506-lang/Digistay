import { blockText } from '@/lib/i18n/content'
import { SearchBar } from '../SearchBar'
import type { PublicBlock, PublicImage, PublicProperty } from '../PropertySite'
import { Container, Eyebrow, propertyTypeLabel, cfgText } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  block: PublicBlock
  property: PublicProperty
  images: PublicImage[]
  /** The page has a map section to link to. */
  hasMap?: boolean
}

interface Photo {
  url: string
  alt: string
}

/**
 * Hero (redesign 3a): direction A's title and copy, the curved photo strip
 * from direction B on wide screens, a flat swipeable strip on phones, and the
 * search bar overlapping the strip.
 */
export function HeroBlock({ block, property, images, hasMap }: Props) {
  const locale = useLocale()
  const t = useTranslations('site')
  const cfg = block.config || {}
  const title = blockText(cfg, locale, 'heroTitle', 'title') ?? property.name
  const subtitle =
    blockText(cfg, locale, 'heroSubtitle', 'subtitle') ?? property.description ?? t('blocks.hero.welcome', { name: property.name })
  const showSearchBar = cfg.showSearchBar !== false

  const urls = [cfgText(cfg, 'backgroundImage'), property.coverImage, ...images.map((i) => i.url)].filter(
    (u): u is string => !!u
  )
  const photos: Photo[] = Array.from(new Set(urls))
    .slice(0, 7)
    .map((url, i) => ({ url, alt: images.find((img) => img.url === url)?.alt ?? t('blocks.hero.photoAlt', { name: property.name, n: i + 1 }) }))

  return (
    <section id="booking" className="scroll-mt-20 pt-12 sm:pt-20 pb-16 sm:pb-24">
      <Container className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
        <div>
          <Eyebrow>
            {propertyTypeLabel(property.type, t)} · {property.city}
          </Eyebrow>
          <h1 className="font-site text-[44px] leading-[52px] sm:text-[64px] sm:leading-[72px] lg:text-display text-fg">
            {title}
          </h1>
        </div>
        <div className="lg:pb-3">
          <p className="text-lead text-muted">{subtitle}</p>
          {hasMap && (
            <a href="#map" className="mt-4 inline-block text-small text-acc hover:underline">
              {t('blocks.hero.seeOnMap')}
            </a>
          )}
        </div>
      </Container>

      {photos.length > 0 && <PhotoStrip photos={photos} />}

      {showSearchBar && (
        <Container className={photos.length > 0 ? 'relative z-10 -mt-10 sm:-mt-14' : 'mt-10'}>
          <SearchBar />
        </Container>
      )}
    </section>
  )
}

/**
 * A 1×1 transparent GIF. A <source> with it, for the screens where an image
 * is hidden, keeps the browser from downloading the photo there: a hidden
 * <img> that is not lazy is still fetched, and on a phone the wide strip's
 * photos competed with the one photo a guest sees first.
 */
const NOTHING = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
/** Below Tailwind's `lg`, where the wide strip is hidden; and from it, where the phone strip is. */
const BELOW_LG = '(max-width: 1023.98px)'
const FROM_LG = '(min-width: 1024px)'

function PhotoStrip({ photos }: { photos: Photo[] }) {
  const t = useTranslations('site.blocks.hero')
  const center = (photos.length - 1) / 2
  return (
    <div className="mt-10 sm:mt-14">
      {/* Wide screens: cards turned toward the middle, like the inside of a curve. */}
      <div className="hidden lg:flex justify-center gap-4 overflow-hidden [perspective:1600px] px-4" aria-hidden="false">
        {photos.map((photo, i) => {
          const d = i - center
          return (
            // `contents`: the <img> stays the flex item.
            <picture key={photo.url} className="contents">
              <source media={BELOW_LG} srcSet={NOTHING} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading={Math.abs(d) <= 1 ? 'eager' : 'lazy'}
                fetchPriority={Math.abs(d) < 1 ? 'high' : undefined}
                className="h-[420px] w-[300px] shrink-0 object-cover motion-reduce:transform-none"
                style={{ transform: `rotateY(${-d * 13}deg) translateZ(${Math.abs(d) * 48}px)` }}
              />
            </picture>
          )
        })}
      </div>
      {/* Phones and tablets: a flat strip to swipe. The first photo is the
          largest thing on a phone's first screen: fetched first, not lazily. */}
      <div className="lg:hidden">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:px-8 pb-2 [scrollbar-width:none]">
          {photos.map((photo, i) => (
            <picture key={photo.url} className="contents">
              {i === 0 && <source media={FROM_LG} srcSet={NOTHING} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                className="aspect-[4/5] w-[78%] sm:w-[46%] shrink-0 snap-center object-cover"
              />
            </picture>
          ))}
        </div>
        {photos.length > 1 && <p className="mt-2 px-4 sm:px-8 text-xs text-muted">{t('swipe', { count: photos.length })}</p>}
      </div>
    </div>
  )
}
