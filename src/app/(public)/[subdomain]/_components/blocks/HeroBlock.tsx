import { MapPin } from 'lucide-react'
import { SearchBar } from '../SearchBar'
import type { PublicBlock, PublicProperty } from '../PropertySite'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function HeroBlock({ block, property }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? property.name
  const subtitle = cfg.subtitle ?? property.description ?? `Chào mừng đến với ${property.name}`
  const backgroundImage =
    cfg.backgroundImage ?? property.coverImage ?? null
  const showSearchBar = cfg.showSearchBar !== false

  return (
    <section
      id="booking"
      className="relative min-h-[480px] md:min-h-[560px] flex items-center justify-center overflow-hidden"
    >
      {/* Background */}
      {backgroundImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundImage}
          alt={property.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)',
          }}
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60" />

      {/* Content */}
      <div className="relative z-10 w-full px-4 py-16 text-center text-white">
        <h1
          className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h1>
        <p className="text-lg md:text-xl mb-6 max-w-2xl mx-auto opacity-90">{subtitle}</p>
        <div className="flex items-center justify-center gap-2 mb-8 text-sm opacity-90">
          <MapPin className="w-4 h-4" />
          <span>
            {property.address}, {property.city}
          </span>
        </div>

        {showSearchBar && (
          <div className="mt-8">
            <SearchBar subdomain={property.id} />
          </div>
        )}
      </div>
    </section>
  )
}
