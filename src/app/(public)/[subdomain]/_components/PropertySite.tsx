import { blockText } from '@/lib/i18n/content'
import { HeroBlock } from './blocks/HeroBlock'
import { RoomsBlock } from './blocks/RoomsBlock'
import { AmenitiesBlock } from './blocks/AmenitiesBlock'
import { AboutBlock } from './blocks/AboutBlock'
import { GalleryBlock } from './blocks/GalleryBlock'
import { MapBlock } from './blocks/MapBlock'
import { ContactBlock } from './blocks/ContactBlock'
import { FooterBlock } from './blocks/FooterBlock'
import { ReviewsBlock } from './blocks/ReviewsBlock'
import { RestaurantMenuBlock } from './blocks/RestaurantMenuBlock'
import { ServicesBlock } from './blocks/ServicesBlock'
import { SiteHeader, type SiteSection } from './SiteHeader'
import { SiteLink } from './site-base'
import { Container, cfgText } from './site-ui'
import { useLocale, useTranslations } from 'next-intl'

type BlockType =
  | 'HERO'
  | 'ROOMS'
  | 'AMENITIES'
  | 'ABOUT'
  | 'GALLERY'
  | 'REVIEWS'
  | 'MAP'
  | 'CONTACT'
  | 'FOOTER'
  | 'RESTAURANT_MENU'
  | 'SERVICES'
  | 'CTA'

export interface PublicProperty {
  id: string
  name: string
  type: string
  description: string | null
  address: string
  city: string
  district: string | null
  country: string
  phone: string | null
  email: string | null
  logo: string | null
  coverImage: string | null
  latitude: number | null
  longitude: number | null
}

export interface PublicImage {
  url: string
  thumbnail: string | null
  alt: string | null
}

export interface PublicAmenity {
  id: string
  name: string
  icon: string | null
  category: string
}

export interface PublicRoomType {
  id: string
  name: string
  description: string | null
  area: number | null
  bedType: string
  maxAdults: number
  maxChildren: number
  totalRooms: number
  image: string | null
  fromPrice: number | null
  weekendPrice: number | null
  amenities: string[]
}

export interface PublicService {
  id: string
  name: string
  description: string | null
  price: number
  priceType: string
  perPerson: boolean
}

/** A dish on the restaurant menu (only those the hotel has on sale). */
export interface PublicMenuItem {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  category: string | null
  sortOrder: number
}

export interface PublicBlock {
  id: string
  type: string
  name: string
  config: Record<string, any>
}

export interface PublicSettings {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  headingFont: string
  layout: string
  metaTitle: string | null
  metaDescription: string | null
  isPublished: boolean
}

interface Props {
  property: PublicProperty
  images: PublicImage[]
  amenities: PublicAmenity[]
  roomTypes: PublicRoomType[]
  services: PublicService[]
  menuItems: PublicMenuItem[]
  blocks: PublicBlock[]
  settings: PublicSettings | null
}

// The header menu: blocks with a section of their own (labels: site.sections).
const SECTION_LABELS: Partial<Record<BlockType, SiteSection>> = {
  ROOMS: { id: 'rooms' },
  AMENITIES: { id: 'amenities' },
  GALLERY: { id: 'gallery' },
  SERVICES: { id: 'services' },
  RESTAURANT_MENU: { id: 'menu' },
  MAP: { id: 'map' },
  CONTACT: { id: 'contact' },
}

/**
 * A hotel's home page, built from the blocks it set up in the website
 * builder (redesign 3a). Colors, fonts and corners come from
 * [subdomain]/layout.tsx; `settings` is kept in the props for callers.
 */
export function PropertySite({ property, images, amenities, roomTypes, services, menuItems, blocks }: Props) {
  const types = new Set(blocks.map((b) => b.type))
  // A block that renders nothing (no photos, no dishes) gets no menu entry either.
  const sections: SiteSection[] = (Object.keys(SECTION_LABELS) as BlockType[])
    .filter(
      (t) =>
        types.has(t) &&
        !(t === 'GALLERY' && images.length === 0) &&
        !(t === 'RESTAURANT_MENU' && menuItems.length === 0) &&
        !(t === 'SERVICES' && services.length === 0)
    )
    .map((t) => SECTION_LABELS[t]!)

  return (
    <>
      <SiteHeader property={property} sections={sections} />
      <main>
        {blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            property={property}
            images={images}
            amenities={amenities}
            roomTypes={roomTypes}
            services={services}
            menuItems={menuItems}
            sections={sections}
            hasMap={types.has('MAP')}
          />
        ))}
      </main>
    </>
  )
}

function BlockRenderer(props: {
  block: PublicBlock
  property: PublicProperty
  images: PublicImage[]
  amenities: PublicAmenity[]
  roomTypes: PublicRoomType[]
  services: PublicService[]
  menuItems: PublicMenuItem[]
  sections: SiteSection[]
  hasMap: boolean
}) {
  const { block } = props
  switch (block.type as BlockType) {
    case 'HERO':
      return <HeroBlock {...props} />
    case 'ROOMS':
      return <RoomsBlock {...props} />
    case 'AMENITIES':
      return <AmenitiesBlock {...props} />
    case 'ABOUT':
      return <AboutBlock {...props} />
    case 'GALLERY':
      return <GalleryBlock {...props} />
    case 'REVIEWS':
      return <ReviewsBlock {...props} />
    case 'MAP':
      return <MapBlock {...props} />
    case 'CONTACT':
      return <ContactBlock {...props} />
    case 'FOOTER':
      return <FooterBlock {...props} />
    case 'RESTAURANT_MENU':
      return <RestaurantMenuBlock {...props} />
    case 'SERVICES':
      return <ServicesBlock {...props} />
    case 'CTA':
      return <CtaBlock {...props} />
    default:
      return null
  }
}

/** Call to action: a dark band with one button (ctaTitle / ctaSubtitle / ctaButtonText / ctaButtonLink). */
function CtaBlock({ block }: { block: PublicBlock }) {
  const locale = useLocale()
  const t = useTranslations('site.blocks.cta')
  const cfg = block.config || {}
  const title = blockText(cfg, locale, 'ctaTitle', 'title') ?? t('title')
  const subtitle = blockText(cfg, locale, 'ctaSubtitle', 'subtitle')
  const label = blockText(cfg, locale, 'ctaButtonText', 'buttonText') ?? t('button')
  const link = cfgText(cfg, 'ctaButtonLink') ?? '#booking'
  const buttonClass =
    'mt-8 inline-flex h-12 items-center rounded-ctl bg-page px-6 text-body font-medium text-fg hover:bg-page/90 transition-colors ' +
    'dark:bg-ink dark:text-on-ink dark:hover:bg-ink/90'

  return (
    // Dark band on the light page; in the dark theme a raised band, not a bright one.
    <section data-band className="bg-ink py-16 sm:py-20 text-on-ink dark:bg-raised dark:text-fg">
      <Container className="max-w-3xl text-center">
        <h2 className="font-site text-[32px] leading-[40px] sm:text-h2">{title}</h2>
        {subtitle && <p className="mt-4 text-lead text-on-ink/80 dark:text-muted">{subtitle}</p>}
        {link.startsWith('/') ? (
          <SiteLink path={link} className={buttonClass}>
            {label}
          </SiteLink>
        ) : /^(#|https?:\/\/)/.test(link) ? (
          <a href={link} className={buttonClass} {...(link.startsWith('http') ? { rel: 'noopener noreferrer' } : {})}>
            {label}
          </a>
        ) : (
          <a href="#booking" className={buttonClass}>
            {label}
          </a>
        )}
      </Container>
    </section>
  )
}
