import { prisma } from '@/lib/db'
import { ratesFrom } from '@/lib/pricing/quote'
import { ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils'

interface PageProps {
  params: Promise<{ subdomain: string; roomId: string }>
}

export const dynamic = 'force-dynamic'

export default async function RoomDetailPage({ params }: PageProps) {
  const { subdomain, roomId } = await params

  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    include: {
      roomTypes: {
        where: { id: roomId, isActive: true },
        include: {
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          ...ROOM_RATE_INCLUDE,
          amenities: { include: { amenity: true } },
        },
      },
      websiteSettings: true,
    },
  })

  if (!property || property.roomTypes.length === 0) {
    notFound()
  }

  const room = property.roomTypes[0]
  // The rates a booking is charged (src/lib/pricing/quote.ts); null: no price yet.
  const pricing = ratesFrom(room.pricing[0], await propertyRateDefaults(prisma, property.id))
  const primaryColor = property.websiteSettings?.primaryColor ?? '#3B82F6'

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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{room.name}</h1>
            <p className="text-sm text-gray-500">{property.name}</p>
          </div>
          <a
            href={`/${subdomain}`}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Quay lại
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Image Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {room.images[0] && (
            <div className="md:col-span-2 h-80 md:h-96 rounded-2xl overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={room.images[0].url}
                alt={room.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {room.images.length > 1 && (
            <div className="hidden md:grid grid-rows-2 gap-4">
              {room.images.slice(1, 3).map((img) => (
                <div key={img.id} className="h-44 rounded-xl overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt || room.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Specs */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">{room.name}</h2>
              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                {room.area && <span className="px-3 py-1 bg-gray-100 rounded-full">{room.area}m²</span>}
                <span className="px-3 py-1 bg-gray-100 rounded-full">{BED_LABELS[room.bedType] || room.bedType}</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full">Tối đa {room.maxOccupancy} khách</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full">{room.totalRooms} phòng</span>
              </div>
            </div>

            {/* Description */}
            {room.description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Mô tả</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{room.description}</p>
              </div>
            )}

            {/* Amenities */}
            {room.amenities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tiện ích trong phòng</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {room.amenities.map((a) => (
                    <div key={a.amenity.id} className="flex items-center gap-2 text-gray-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                      {a.amenity.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Policies placeholder */}
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Chính sách</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Nhận phòng: 14:00</li>
                <li>• Trả phòng: 12:00</li>
                <li>• Hủy miễn phí trước 24 giờ</li>
                <li>• Không hút thuốc trong phòng</li>
              </ul>
            </div>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <p className="text-sm text-gray-500">Giá từ</p>
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {pricing ? formatCurrency(pricing.weekdayPrice) : 'Liên hệ'}
                  {pricing && <span className="text-base font-normal text-gray-400"> /đêm</span>}
                </p>
                {pricing?.weekendPrice && pricing.weekendPrice !== pricing.weekdayPrice && (
                  <p className="text-sm text-gray-500 mt-1">
                    Cuối tuần: {formatCurrency(pricing.weekendPrice)}/đêm
                  </p>
                )}
              </div>

              {/* The search page takes the booking (there is no /booking page). */}
              <form action={`/${subdomain}/search`} method="GET">
                <input type="hidden" name="roomTypeId" value={room.id} />
                <input type="hidden" name="checkIn" value={format(new Date(), 'yyyy-MM-dd')} />
                <input type="hidden" name="checkOut" value={format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')} />

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl text-white font-semibold text-center transition hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  Đặt phòng ngay
                </button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-3">
                Miễn phí hủy trước 24h
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
