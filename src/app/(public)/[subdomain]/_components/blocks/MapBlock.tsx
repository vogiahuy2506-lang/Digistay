import { MapPin } from 'lucide-react'
import type { PublicBlock, PublicProperty } from '../PropertySite'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function MapBlock({ block, property }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Vị trí'

  const fullAddress = `${property.address}, ${property.district ?? ''}, ${property.city}, ${property.country}`
    .replace(/, ,/g, ',')
    .trim()
  const mapboxUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
  const embedUrl =
    property.latitude && property.longitude
      ? `https://www.google.com/maps?q=${property.latitude},${property.longitude}&hl=vi&z=15&output=embed`
      : `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&hl=vi&z=15&output=embed`

  return (
    <section id="map" className="py-16 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-center text-gray-600 mb-8 flex items-center justify-center gap-2">
          <MapPin className="w-4 h-4" />
          {fullAddress}
        </p>

        <div className="rounded-2xl overflow-hidden shadow-lg">
          <iframe
            src={embedUrl}
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Bản đồ vị trí"
          />
        </div>

        <div className="text-center mt-6">
          <a
            href={mapboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-lg font-medium text-white hover:opacity-90 transition"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            Mở Google Maps chỉ đường
          </a>
        </div>
      </div>
    </section>
  )
}
