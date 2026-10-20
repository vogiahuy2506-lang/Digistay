import { Card, CardContent, Button } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { SiteLink } from '../site-base'
import type { PublicBlock, PublicProperty, PublicRoomType } from '../PropertySite'

interface Props {
  block: PublicBlock
  property: PublicProperty
  roomTypes: PublicRoomType[]
}

const BED_LABELS: Record<string, string> = {
  SINGLE: '1 giường đơn',
  DOUBLE: '1 giường đôi',
  TWIN: '2 giường đơn',
  TRIPLE: '3 giường đơn',
  QUADRUPLE: '4 giường đơn',
  KING: '1 giường King',
  QUEEN: '1 giường Queen',
  SUITE: 'Suite',
  BUNK: 'Giường tầng',
}

export function RoomsBlock({ block, roomTypes, property }: Props) {
  const cfg = block.config || {}
  const title = cfg.title ?? 'Các hạng phòng'
  const showPrice = cfg.showPrice !== false
  const showCTA = cfg.showCTA !== false

  if (roomTypes.length === 0) {
    return (
      <section id="rooms" className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2
            className="text-3xl font-bold text-center mb-8"
            style={{ fontFamily: 'var(--brand-font-heading)' }}
          >
            {title}
          </h2>
          <p className="text-center text-gray-500">
            Chưa có hạng phòng nào. Vui lòng liên hệ trực tiếp với {property.name}.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section id="rooms" className="py-16 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-4"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        >
          {title}
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Chọn phòng phù hợp với nhu cầu của bạn
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roomTypes.map((room) => (
            <Card key={room.id} className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="relative h-48 bg-gray-200">
                {room.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    Không có ảnh
                  </div>
                )}
              </div>
              <CardContent className="p-5">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{room.name}</h3>
                {room.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{room.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                  {room.area && <span>{room.area}m²</span>}
                  {room.area && <span>•</span>}
                  <span>{BED_LABELS[room.bedType] ?? room.bedType}</span>
                  <span>•</span>
                  <span>Tối đa {room.maxAdults + room.maxChildren} khách</span>
                </div>
                {room.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {room.amenities.slice(0, 4).map((a, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                      >
                        {a}
                      </span>
                    ))}
                    {room.amenities.length > 4 && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                        +{room.amenities.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {showPrice && room.fromPrice != null && (
                  <div className="border-t pt-3 mt-2">
                    <p className="text-xs text-gray-500">Giá từ</p>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: 'var(--brand-primary)' }}
                    >
                      {formatCurrency(room.fromPrice)}
                      <span className="text-sm text-gray-500 font-normal"> /đêm</span>
                    </p>
                    {room.weekendPrice && room.weekendPrice !== room.fromPrice && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Cuối tuần: {formatCurrency(room.weekendPrice)}
                      </p>
                    )}
                  </div>
                )}

                {showCTA && (
                  // Was /<property id>/rooms/..., a 404: the route takes the subdomain.
                  <SiteLink
                    path={`/rooms/${room.id}`}
                    className="mt-4 block w-full text-center text-white py-2 rounded-lg font-medium hover:opacity-90 transition"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    Xem phòng / Đặt ngay
                  </SiteLink>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
