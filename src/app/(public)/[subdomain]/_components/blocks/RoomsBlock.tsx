import { blockText } from '@/lib/i18n/content'
import { formatVnd } from '@/lib/bookings/display'
import { responsiveImage } from '@/lib/media/image-url'
import type { PublicBlock, PublicProperty, PublicRoomType } from '../PropertySite'
import { SiteLink } from '../site-base'
import { PhotoPlaceholder, Section, SectionHeader, roomMeta } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  block: PublicBlock
  property: PublicProperty
  roomTypes: PublicRoomType[]
}

/** Room types (redesign 3a): photo, name + price per night, one line of facts, the first amenities, details and "Đặt ngay". */
export function RoomsBlock({ block, roomTypes, property }: Props) {
  const t = useTranslations('site')
  const locale = useLocale()
  const cfg = block.config || {}
  const title = blockText(cfg, locale, 'roomsTitle', 'title') ?? t('blocks.rooms.title')
  const showPrice = cfg.showPrice !== false
  const showCTA = cfg.showCTA !== false
  const limit = Number(cfg.roomsLimit) > 0 ? Number(cfg.roomsLimit) : undefined
  const rooms = roomTypes.slice(0, limit)
  const AMENITIES_SHOWN = 3

  return (
    <Section id="rooms">
      <SectionHeader
        title={title}
        aside={rooms.length > 0 ? t('blocks.rooms.count', { count: roomTypes.length, name: property.name }) : undefined}
      />
      {rooms.length === 0 ? (
        <p className="text-body text-muted">
          {t('blocks.rooms.empty', { name: property.name })}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.map((room) => (
            <li key={room.id} className="flex flex-col border border-line bg-panel rounded-box overflow-hidden">
              {room.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img {...responsiveImage(room.image, '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw', { fallback: 800 })} alt={room.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                // One column on phones: no photo to line up with, so no tall empty block.
                <PhotoPlaceholder label={t('room.noPhoto')} className="h-28 w-full sm:h-auto sm:aspect-[4/3]" />
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-body font-semibold text-fg">{room.name}</h3>
                  {showPrice && room.fromPrice != null && room.fromPrice > 0 && (
                    <p className="shrink-0 text-right text-body font-semibold tabular-nums text-fg">
                      {formatVnd(room.fromPrice, locale)}
                      <span className="text-xs font-normal text-muted">{t('units.perNight')}</span>
                    </p>
                  )}
                </div>
                <p className="mt-1 text-small text-muted">{roomMeta(room, t)}</p>
                {room.amenities.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('room.amenities')}>
                    {room.amenities.slice(0, AMENITIES_SHOWN).map((name) => (
                      <li key={name} className="rounded-ctl bg-fg/5 px-2 py-0.5 text-xs text-fg">
                        {name}
                      </li>
                    ))}
                    {room.amenities.length > AMENITIES_SHOWN && (
                      <li className="px-1 py-0.5 text-xs text-muted">
                        {t('room.moreAmenities', { count: room.amenities.length - AMENITIES_SHOWN })}
                      </li>
                    )}
                  </ul>
                )}
                {showCTA && (
                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                      <SiteLink path={`/rooms/${room.id}`} className="text-small font-medium text-acc hover:underline">
                        {t('room.details')}
                      </SiteLink>
                      {/* The room page's booking box: dates, guests, then the booking form. */}
                      <SiteLink
                        path={`/rooms/${room.id}#dat-phong`}
                        className="inline-flex h-10 shrink-0 items-center rounded-ctl bg-ink px-4 text-small font-medium text-on-ink transition-colors hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                      >
                        {t('room.bookNow')}
                      </SiteLink>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
