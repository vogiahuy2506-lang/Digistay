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
import { SiteHeader } from './SiteHeader'

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
  blocks: PublicBlock[]
  settings: PublicSettings | null
}

export function PropertySite({
  property,
  images,
  amenities,
  roomTypes,
  services,
  blocks,
  settings,
}: Props) {
  const primary = settings?.primaryColor ?? '#3B82F6'
  const bodyFont = settings?.fontFamily ?? 'Inter'
  const headingFont = settings?.headingFont ?? 'Inter'

  // Inject brand colors + fonts as CSS custom properties so blocks can use them.
  // eslint-disable-next-line
  const themeStyle: React.CSSProperties = {
    ['--brand-primary' as any]: primary,
    ['--brand-secondary' as any]: settings?.secondaryColor ?? '#10B981',
    ['--brand-accent' as any]: settings?.accentColor ?? '#F59E0B',
    ['--brand-font-body' as any]: bodyFont,
    ['--brand-font-heading' as any]: headingFont,
  }

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily: `var(--brand-font-body), system-ui, sans-serif`,
        ...themeStyle,
      }}
    >
      <SiteHeader property={property} />

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
          />
        ))}
      </main>
    </div>
  )
}

function BlockRenderer(props: {
  block: PublicBlock
  property: PublicProperty
  images: PublicImage[]
  amenities: PublicAmenity[]
  roomTypes: PublicRoomType[]
  services: PublicService[]
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
      return <CtaFallback {...props} />
    default:
      return null
  }
}

function CtaFallback({ block }: { block: PublicBlock }) {
  return (
    <section className="py-12 px-4" style={{ backgroundColor: 'var(--brand-primary)' }}>
      <div className="max-w-4xl mx-auto text-center text-white">
        <h2 className="text-3xl font-bold mb-4">{block.config?.title ?? 'Đặt phòng ngay'}</h2>
        <p className="mb-6 opacity-90">{block.config?.subtitle ?? 'Trải nghiệm dịch vụ tuyệt vời'}</p>
        <a
          href="#booking"
          className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
        >
          {block.config?.buttonText ?? 'Đặt ngay'}
        </a>
      </div>
    </section>
  )
}
