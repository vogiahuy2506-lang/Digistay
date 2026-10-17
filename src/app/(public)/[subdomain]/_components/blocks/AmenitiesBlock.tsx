import { getIcon } from '../icon-map'
import type { PublicAmenity, PublicBlock } from '../PropertySite'

interface Props {
  block: PublicBlock
  amenities: PublicAmenity[]
}

export function AmenitiesBlock({ block, amenities }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Tiện ích'

  if (amenities.length === 0) return null

  return (
    <section id="amenities" className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-center text-gray-600 mb-12">Mọi tiện nghi bạn cần</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {amenities.map((amenity) => {
            const Icon = getIcon(amenity.icon)
            return (
              <div
                key={amenity.id}
                className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-700">{amenity.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
