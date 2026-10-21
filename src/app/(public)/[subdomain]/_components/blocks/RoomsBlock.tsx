import { formatVnd } from '@/lib/bookings/display'
import type { PublicBlock, PublicProperty, PublicRoomType } from '../PropertySite'
import { SiteLink } from '../site-base'
import { PhotoPlaceholder, Section, SectionHeader, cfgText, roomMeta } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  block: PublicBlock
  property: PublicProperty
  roomTypes: PublicRoomType[]
}

/** Room types (redesign 3a): photo, name + price per night, one line of facts. */
export function RoomsBlock({ block, roomTypes, property }: Props) {
  const t = useTranslations('site')
  const locale = useLocale()
  const cfg = block.config || {}
  const title = cfgText(cfg, 'roomsTitle', 'title') ?? t('blocks.rooms.title')
  const showPrice = cfg.showPrice !== false
  const showCTA = cfg.showCTA !== false
  const limit = Number(cfg.roomsLimit) > 0 ? Number(cfg.roomsLimit) : undefined
  const rooms = roomTypes.slice(0, limit)

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
                <img src={room.image} alt={room.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <PhotoPlaceholder label={t('room.noPhoto')} className="aspect-[4/3] w-full" />
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
                {showCTA && (
                  <div className="mt-auto pt-4">
                    <div className="border-t border-line pt-4">
                      <SiteLink path={`/rooms/${room.id}`} className="text-small font-medium text-acc hover:underline">
                        {t('room.details')}
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
