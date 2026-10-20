import { SearchBar } from '../SearchBar'
import type { PublicBlock, PublicImage, PublicProperty } from '../PropertySite'
import { Container, Eyebrow, cfgText, propertyTypeLabel } from '../site-ui'

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
  const cfg = block.config || {}
  const title = cfgText(cfg, 'heroTitle', 'title') ?? property.name
  const subtitle =
    cfgText(cfg, 'heroSubtitle', 'subtitle') ?? property.description ?? `Chào mừng đến với ${property.name}`
  const showSearchBar = cfg.showSearchBar !== false

  const urls = [cfgText(cfg, 'backgroundImage'), property.coverImage, ...images.map((i) => i.url)].filter(
    (u): u is string => !!u
  )
  const photos: Photo[] = Array.from(new Set(urls))
    .slice(0, 7)
    .map((url, i) => ({ url, alt: images.find((img) => img.url === url)?.alt ?? `${property.name} — ảnh ${i + 1}` }))

  return (
    <section id="booking" className="scroll-mt-20 pt-12 sm:pt-20 pb-16 sm:pb-24">
      <Container className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
        <div>
          <Eyebrow>
            {propertyTypeLabel(property.type)} · {property.city}
          </Eyebrow>
          <h1 className="font-site text-[44px] leading-[52px] sm:text-[64px] sm:leading-[72px] lg:text-display text-fg">
            {title}
          </h1>
        </div>
        <div className="lg:pb-3">
          <p className="text-lead text-muted">{subtitle}</p>
          {hasMap && (
            <a href="#map" className="mt-4 inline-block text-small text-acc hover:underline">
              Xem vị trí trên bản đồ →
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

function PhotoStrip({ photos }: { photos: Photo[] }) {
  const center = (photos.length - 1) / 2
  return (
    <div className="mt-10 sm:mt-14">
      {/* Wide screens: cards turned toward the middle, like the inside of a curve. */}
      <div className="hidden lg:flex justify-center gap-4 overflow-hidden [perspective:1600px] px-4" aria-hidden="false">
        {photos.map((photo, i) => {
          const d = i - center
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={photo.alt}
              loading={Math.abs(d) <= 1 ? 'eager' : 'lazy'}
              className="h-[420px] w-[300px] shrink-0 object-cover motion-reduce:transform-none"
              style={{ transform: `rotateY(${-d * 13}deg) translateZ(${Math.abs(d) * 48}px)` }}
            />
          )
        })}
      </div>
      {/* Phones and tablets: a flat strip to swipe. */}
      <div className="lg:hidden">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:px-8 pb-2 [scrollbar-width:none]">
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={photo.alt}
              loading="lazy"
              className="aspect-[4/5] w-[78%] sm:w-[46%] shrink-0 snap-center object-cover"
            />
          ))}
        </div>
        {photos.length > 1 && <p className="mt-2 px-4 sm:px-8 text-xs text-muted">Vuốt ngang để xem {photos.length} ảnh</p>}
      </div>
    </div>
  )
}
