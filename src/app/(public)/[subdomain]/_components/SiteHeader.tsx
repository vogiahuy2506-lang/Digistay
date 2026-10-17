import { Star, Phone } from 'lucide-react'
import type { PublicProperty } from './PropertySite'

export function SiteHeader({ property }: { property: PublicProperty }) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {property.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.logo}
              alt={property.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {property.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1
              className="font-semibold text-gray-900"
              style={{ fontFamily: 'var(--brand-font-heading)' }}
            >
              {property.name}
            </h1>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="font-medium">{propertyTypeLabel(property.type)}</span>
              <span>·</span>
              <span>{property.city}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {property.phone && (
            <a
              href={`tel:${property.phone}`}
              className="hidden md:flex items-center gap-2 text-gray-600 hover:opacity-80"
              style={{ color: 'var(--brand-primary)' }}
            >
              <Phone className="w-5 h-5" />
              <span>{property.phone}</span>
            </a>
          )}
          <a
            href="#booking"
            className="text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            Đặt phòng
          </a>
        </div>
      </div>
    </header>
  )
}

function propertyTypeLabel(type: string): string {
  switch (type) {
    case 'HOTEL':
      return 'Khách sạn'
    case 'HOMESTAY':
      return 'Homestay'
    case 'RESORT':
      return 'Resort'
    case 'RESTAURANT':
      return 'Nhà hàng'
    case 'VILLA':
      return 'Villa'
    case 'MOTEL':
      return 'Motel'
    default:
      return 'Cơ sở lưu trú'
  }
}
