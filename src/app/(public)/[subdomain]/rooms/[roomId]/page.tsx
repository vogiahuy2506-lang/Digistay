import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { SiteHeader, type SiteSection } from '../../_components/SiteHeader'
import { SiteLink } from '../../_components/site-base'
import { Container, bedLabel, roomMeta } from '../../_components/site-ui'
import { getIcon } from '../../_components/icon-map'
import { formatVnd } from '@/lib/bookings/display'
import { BookingBox } from './BookingBox'

interface PageProps {
  params: Promise<{ subdomain: string; roomId: string }>
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>
}

export const dynamic = 'force-dynamic'

const SECTIONS: Record<string, SiteSection> = {
  ROOMS: { id: 'rooms', label: 'Phòng' },
  AMENITIES: { id: 'amenities', label: 'Tiện ích' },
  MAP: { id: 'map', label: 'Vị trí' },
  CONTACT: { id: 'contact', label: 'Liên hệ' },
}

const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)

/** A room type's page (redesign 2c). */
export default async function RoomDetailPage({ params, searchParams }: PageProps) {
  const { subdomain, roomId } = await params
  const query = await searchParams

  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: {
      name: true,
      type: true,
      city: true,
      phone: true,
      policy: true,
      websiteBlocks: { where: { isEnabled: true }, select: { type: true } },
      roomTypes: {
        where: { id: roomId, isActive: true },
        include: {
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          // The newest pricing, as POST /api/bookings charges it.
          pricing: { include: { pricing: true }, take: 1, orderBy: { createdAt: 'desc' } },
          amenities: { include: { amenity: true } },
        },
      },
    },
  })

  if (!property || property.roomTypes.length === 0) {
    notFound()
  }

  const room = property.roomTypes[0]
  const config = room.pricing[0]?.pricing
  const pricing = config
    ? {
        weekdayPrice: config.weekdayPrice,
        weekendPrice: config.weekendPrice,
        extraAdultPrice: config.extraAdultPrice,
        extraChildPrice: config.extraChildPrice,
        baseOccupancy: room.baseOccupancy,
      }
    : null
  const blockTypes = new Set(property.websiteBlocks.map((b) => b.type))
  const sections = Object.entries(SECTIONS)
    .filter(([type]) => blockTypes.size === 0 || blockTypes.has(type as never))
    .map(([, s]) => s)
  const policy = property.policy
  const photos = room.images

  const specs = [
    { label: 'Diện tích', value: room.area ? `${room.area} m²` : '—' },
    { label: 'Loại giường', value: bedLabel(room.bedType) },
    { label: 'Tối đa người lớn', value: String(room.maxAdults) },
    { label: 'Tối đa trẻ em', value: String(room.maxChildren) },
  ]

  const policies: { title: string; text: string }[] = []
  if (policy) {
    policies.push({ title: 'Nhận / trả phòng', text: `Nhận từ ${policy.checkInTime} · Trả trước ${policy.checkOutTime}.` })
    if (policy.cancellationHours != null || policy.cancellationPolicy) {
      policies.push({
        title: 'Hủy phòng',
        text: [
          policy.cancellationHours != null ? `Miễn phí khi hủy trước giờ nhận phòng ${policy.cancellationHours} giờ.` : null,
          policy.cancellationPolicy,
        ]
          .filter(Boolean)
          .join(' '),
      })
    }
    policies.push({
      title: 'Trẻ em',
      text: policy.childrenAllowed
        ? policy.minChildAge > 0
          ? `Nhận trẻ từ ${policy.minChildAge} tuổi.`
          : 'Nhận trẻ em mọi độ tuổi.'
        : 'Không nhận trẻ em.',
    })
    policies.push({
      title: 'Thú cưng · hút thuốc',
      text: `${policy.petsAllowed ? 'Cho phép' : 'Không cho phép'} thú cưng. ${policy.smokingAllowed ? 'Có khu vực hút thuốc' : 'Không hút thuốc'}.`,
    })
    if (policy.additionalRules) policies.push({ title: 'Quy định khác', text: policy.additionalRules })
  }

  return (
    <>
      <SiteHeader property={property} sections={sections} onHome={false} />

      <main className="pb-28 lg:pb-24">
        <Container className="pt-6 sm:pt-10">
          <nav aria-label="Đường dẫn" className="text-small">
            <SiteLink path="/" className="text-acc hover:underline">
              Trang chủ
            </SiteLink>
            <span className="text-muted"> / </span>
            <SiteLink path="/#rooms" className="text-acc hover:underline">
              Phòng
            </SiteLink>
            <span className="text-muted"> / </span>
            <span className="text-fg">{room.name}</span>
          </nav>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="font-site text-[40px] leading-[48px] sm:text-h1 text-fg">{room.name}</h1>
            <p className="text-small text-muted lg:pb-2">{roomMeta(room)}</p>
          </div>

          {photos.length > 0 && (
            <div className="mt-8 grid gap-2 lg:grid-cols-[2fr_1fr_1fr] lg:grid-rows-2">
              {photos.slice(0, 5).map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.alt || `${room.name} — ảnh ${i + 1}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className={
                    i === 0
                      ? 'h-[280px] w-full object-cover sm:h-[420px] lg:row-span-2 lg:h-[528px]'
                      : 'hidden h-[260px] w-full object-cover lg:block'
                  }
                />
              ))}
            </div>
          )}

          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-16">
            <div className="space-y-12">
              {room.description && <p className="max-w-2xl text-lead text-fg whitespace-pre-line">{room.description}</p>}

              <section>
                <h2 className="font-site text-h3 text-fg">Thông số</h2>
                <dl className="mt-5 grid grid-cols-2 border-y border-line sm:grid-cols-4">
                  {specs.map((s, i) => (
                    <div key={s.label} className={`py-5 pr-4 ${i > 0 ? 'sm:border-l sm:border-line sm:pl-5' : ''} ${i % 2 === 1 ? 'border-l border-line pl-5 sm:pl-5' : ''}`}>
                      <dt className="text-label uppercase text-muted">{s.label}</dt>
                      <dd className="mt-1 text-body text-fg">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {room.amenities.length > 0 && (
                <section>
                  <h2 className="font-site text-h3 text-fg">Tiện ích trong phòng</h2>
                  <ul className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                    {room.amenities.map(({ amenity }) => {
                      const Icon = getIcon(amenity.icon)
                      return (
                        <li key={amenity.id} className="flex items-center gap-3 border-b border-line py-3 text-body text-fg">
                          <Icon className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                          {amenity.name}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {policies.length > 0 && (
                <section>
                  <h2 className="font-site text-h3 text-fg">Chính sách</h2>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {policies.map((p) => (
                      <li key={p.title} className="border border-line bg-panel p-5">
                        <h3 className="text-body font-medium text-fg">{p.title}</h3>
                        <p className="mt-1 text-small text-muted whitespace-pre-line">{p.text}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <BookingBox
                pricing={pricing}
                maxAdults={room.maxAdults}
                maxChildren={room.maxChildren}
                checkIn={day(query.checkIn)}
                checkOut={day(query.checkOut)}
              />
            </aside>
          </div>
        </Container>
      </main>

      {/* Phones: the price and the button stay at the bottom (redesign 2c mobile). */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-line bg-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <p className="text-body font-semibold tabular-nums text-fg">
          {pricing && pricing.weekdayPrice > 0 ? (
            <>
              {formatVnd(pricing.weekdayPrice)}
              <span className="text-xs font-normal text-muted"> /đêm</span>
            </>
          ) : (
            'Liên hệ để biết giá'
          )}
        </p>
        <a href="#dat-phong" className="inline-flex h-11 items-center rounded-ctl bg-ink px-6 text-small font-medium text-on-ink">
          Đặt phòng
        </a>
      </div>
    </>
  )
}
