import { useLocale, useTranslations } from 'next-intl'
import { formatVnd } from '@/lib/bookings/display'
import { cn } from '@/lib/utils'

const TZ = 'Asia/Ho_Chi_Minh'

/** "T6, 23/10/2026" / "Fri, 23/10/2026" from a yyyy-mm-dd string or a date. */
export function stayDate(value: string | Date, locale: string, withYear = true): string {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00+07:00`) : value
  return date.toLocaleDateString(locale === 'en' ? 'en-GB' : 'vi-VN', {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    ...(withYear && { year: 'numeric' }),
  })
}

export interface SummaryLine {
  label: string
  sub?: string
  amount: number
}

/**
 * The stay on the right of the booking steps: room, dates, guests, the
 * amounts, and the deposit / pay-at-hotel split. `compact`: the small
 * thumbnail version of the deposit page.
 */
export function StaySummary({
  room,
  checkIn,
  checkOut,
  checkInTime,
  checkOutTime,
  nights,
  adults,
  children,
  lines,
  total,
  deposit,
  note,
  compact,
}: {
  room: { name: string; image: string | null; spec: string } | null
  checkIn: string | Date
  checkOut: string | Date
  checkInTime: string
  checkOutTime: string
  nights: number
  adults: number
  children: number
  lines: SummaryLine[]
  total: number
  deposit?: { amount: number; paid: boolean } | null
  note?: string
  compact?: boolean
}) {
  const t = useTranslations('site')
  const locale = useLocale()
  const lang = locale === 'en' ? 'en' : 'vi'
  const guests = [t('units.adults', { count: adults }), ...(children > 0 ? [t('units.children', { count: children })] : [])].join(', ')
  const money = (n: number) => formatVnd(n, lang)

  return (
    <aside className={cn('overflow-hidden border border-line bg-panel', !compact && 'shadow-lift')}>
      {room && !compact && (
        <div className="aspect-[440/200] bg-plain-soft">
          {room.image && (
            // eslint-disable-next-line @next/next/no-img-element -- hotel photos from its own storage, any size
            <img src={room.image} alt={t('booking.common.photoOf', { name: room.name })} className="h-full w-full object-cover" />
          )}
        </div>
      )}
      <div className={cn(compact ? 'p-5' : 'p-6 lg:p-7')}>
        {room && (
          <div className={cn(compact && 'flex gap-4')}>
            {compact && (
              <div className="h-[88px] w-[88px] flex-none bg-plain-soft">
                {room.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- see above
                  <img src={room.image} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            )}
            <div className="min-w-0">
              <h2 className={cn('font-site text-fg', compact ? 'text-[20px] leading-tight' : 'text-[26px] leading-tight')}>{room.name}</h2>
              <p className="mt-1 text-[13.5px] text-muted">
                {compact
                  ? `${stayDate(checkIn, locale, false)} → ${stayDate(checkOut, locale, false)} · ${t('units.nights', { count: nights })}`
                  : room.spec}
              </p>
              {compact && <p className="text-[13.5px] text-muted">{guests}</p>}
            </div>
          </div>
        )}

        {!compact && (
          <>
            <div className="mt-5 grid grid-cols-2 border border-line">
              <div className="border-r border-line px-3.5 py-3">
                <p className="text-label uppercase text-muted">{t('stay.checkIn')}</p>
                <p className="mt-1 text-[15px] font-medium text-fg">{stayDate(checkIn, locale)}</p>
                <p className="text-[12.5px] text-muted">{t('booking.common.checkInFrom', { time: checkInTime })}</p>
              </div>
              <div className="px-3.5 py-3">
                <p className="text-label uppercase text-muted">{t('stay.checkOut')}</p>
                <p className="mt-1 text-[15px] font-medium text-fg">{stayDate(checkOut, locale)}</p>
                <p className="text-[12.5px] text-muted">{t('booking.common.checkOutBy', { time: checkOutTime })}</p>
              </div>
            </div>
            <p className="mt-4 border-b border-line pb-4 text-[14px] text-fg">
              {t('units.nights', { count: nights })} · {guests}
            </p>
          </>
        )}

        <dl className={cn('flex flex-col gap-2.5 text-[14px]', compact ? 'mt-5 border-t border-line pt-4' : 'mt-4')}>
          {lines.map((line, i) => (
            <div key={i}>
              <div className="flex justify-between gap-4">
                <dt className="text-fg">{line.label}</dt>
                <dd className="whitespace-nowrap tabular-nums text-fg">{money(line.amount)}</dd>
              </div>
              {line.sub && <p className="mt-0.5 text-[12.5px] text-muted">{line.sub}</p>}
            </div>
          ))}
        </dl>
        <div className={cn('mt-4 flex items-baseline justify-between gap-4 border-t border-line pt-4')}>
          <span className="text-[14px] font-semibold">{t('booking.common.total')}</span>
          <span className={cn('font-semibold tabular-nums text-fg', compact ? 'text-[16px]' : 'text-[24px]')}>{money(total)}</span>
        </div>
        {deposit && deposit.amount > 0 && (
          <dl className={cn('mt-4 flex flex-col gap-1.5 text-[14px]', compact ? '' : 'bg-plain-soft/70 px-4 py-3')}>
            <div className="flex justify-between gap-4">
              <dt>{deposit.paid ? t('booking.common.depositPaid') : t('booking.common.depositToday')}</dt>
              <dd className="font-semibold tabular-nums">{money(deposit.amount)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-muted">
              <dt>{t('booking.common.atHotel')}</dt>
              <dd className="tabular-nums">{money(Math.max(0, total - deposit.amount))}</dd>
            </div>
          </dl>
        )}
        {note && <p className="mt-4 border-t border-line pt-4 text-[13px] leading-[1.55] text-muted">{note}</p>}
      </div>
    </aside>
  )
}
