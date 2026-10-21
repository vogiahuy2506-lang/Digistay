'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import { formatVnd } from '@/lib/bookings/display'
import { quoteStay, type Rates } from '@/lib/pricing/quote'
import { useSiteHref } from '../../_components/site-base'
import { useLocale, useTranslations } from 'next-intl'

function vnDay(offsetDays = 0): string {
  return new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10)
}

interface Props {
  /** null: the room type has no price yet */
  rates: Rates | null
  /** guests included in the room price */
  baseOccupancy: number
  maxAdults: number
  maxChildren: number
  /** Initial dates from the link that opened the page. */
  checkIn?: string
  checkOut?: string
}

/** Sticky booking box (redesign 2c): price per night, dates, guests, running total. */
export function BookingBox({ rates, baseOccupancy, maxAdults, maxChildren, checkIn: initialIn, checkOut: initialOut }: Props) {
  const t = useTranslations('site')
  const locale = useLocale()
  const router = useRouter()
  const href = useSiteHref()
  const [checkIn, setCheckIn] = useState(initialIn || vnDay(0))
  const [checkOut, setCheckOut] = useState(initialOut || vnDay(1))
  const [adults, setAdults] = useState(Math.min(2, Math.max(1, maxAdults)))
  const [children, setChildren] = useState(0)

  const validDates = !!checkIn && !!checkOut && checkOut > checkIn
  // The same price the booking is charged (src/lib/pricing/quote.ts).
  const priced = rates
  const estimate =
    priced && validDates
      ? quoteStay({
          rates: priced,
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          numAdults: adults,
          numChildren: children,
          baseOccupancy,
        })
      : null

  const book = () => {
    if (!validDates) return
    const params = new URLSearchParams({ checkIn, checkOut, adults: String(adults), children: String(children) })
    router.push(href(`/search?${params}`))
  }

  const cell = 'px-4 py-3'
  const label = 'block text-label uppercase text-muted'
  const stepBtn =
    'flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg hover:border-muted disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
  const stepper = (name: string, value: number, min: number, max: number, set: (n: number) => void) => (
    <div className={cell}>
      <span className={label}>{name}</span>
      <div className="mt-1.5 flex items-center justify-between">
        <button type="button" className={stepBtn} onClick={() => set(value - 1)} disabled={value <= min} aria-label={t('stay.decrease', { what: name.toLowerCase() })}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="text-body tabular-nums" aria-live="polite">{value}</span>
        <button type="button" className={stepBtn} onClick={() => set(value + 1)} disabled={value >= max} aria-label={t('stay.increase', { what: name.toLowerCase() })}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )

  return (
    <div id="dat-phong" className="scroll-mt-24 border border-line bg-raised p-6 shadow-lift">
      {priced ? (
        <p className="text-[28px] leading-9 font-semibold tabular-nums text-fg">
          {formatVnd(priced.weekdayPrice, locale)}
          <span className="text-small font-normal text-muted"> {t('units.perNight')}</span>
        </p>
      ) : (
        <p className="text-body font-medium text-fg">{t('room.contactForPrice')}</p>
      )}
      {priced && priced.weekendPrice !== priced.weekdayPrice ? (
        <p className="mt-1 text-small text-muted">{t('bookingBox.weekend', { price: formatVnd(priced.weekendPrice, locale) })}</p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 border border-line [&>*]:border-line [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b">
        <label className={cell}>
          <span className={label}>{t('stay.checkIn')}</span>
          <input
            type="date"
            value={checkIn}
            min={vnDay(0)}
            onChange={(e) => {
              setCheckIn(e.target.value)
              if (e.target.value >= checkOut) {
                setCheckOut(new Date(Date.parse(`${e.target.value}T00:00:00Z`) + 86400000).toISOString().slice(0, 10))
              }
            }}
            className="mt-1 w-full bg-transparent text-small text-fg focus:outline-none [color-scheme:light]"
          />
        </label>
        <label className={cell}>
          <span className={label}>{t('stay.checkOut')}</span>
          <input
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-1 w-full bg-transparent text-small text-fg focus:outline-none [color-scheme:light]"
          />
        </label>
        {stepper(t('stay.adults'), adults, 1, Math.max(1, maxAdults), setAdults)}
        {stepper(t('stay.children'), children, 0, Math.max(0, maxChildren), setChildren)}
      </div>

      {(adults >= maxAdults || (maxChildren > 0 && children >= maxChildren)) && (
        <p className="mt-3 bg-warn-soft px-3 py-2 text-small text-warn">
          {maxChildren > 0
            ? t('bookingBox.maxOccupancyWithChildren', { adults: t('units.adults', { count: maxAdults }), children: t('units.children', { count: maxChildren }) })
            : t('bookingBox.maxOccupancy', { adults: t('units.adults', { count: maxAdults }) })}
        </p>
      )}

      {estimate && (
        <dl className="mt-5 space-y-2 text-small">
          {estimate.weekdayNights > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                {formatVnd(priced!.weekdayPrice, locale)} × {t('units.nights', { count: estimate.weekdayNights })}
              </dt>
              <dd className="tabular-nums text-fg">{formatVnd(estimate.weekdayNights * priced!.weekdayPrice, locale)}</dd>
            </div>
          )}
          {estimate.weekendNights > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                {formatVnd(priced!.weekendPrice, locale)} × {t('units.weekendNights', { count: estimate.weekendNights })}
              </dt>
              <dd className="tabular-nums text-fg">{formatVnd(estimate.weekendNights * priced!.weekendPrice, locale)}</dd>
            </div>
          )}
          {estimate.extraCharges > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('bookingBox.extraGuests')}</dt>
              <dd className="tabular-nums text-fg">{formatVnd(estimate.extraCharges, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-line pt-3 text-body font-semibold">
            <dt className="text-fg">{t('bookingBox.estimate')}</dt>
            <dd className="tabular-nums text-fg">{formatVnd(estimate.total, locale)}</dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        onClick={book}
        disabled={!validDates}
        className="mt-6 flex h-[52px] w-full items-center justify-center rounded-ctl bg-ink text-body font-medium text-on-ink hover:bg-ink/90 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2"
      >
        {t('bookingBox.book')}
      </button>
      <p className="mt-3 text-center text-xs text-muted">{t('bookingBox.noChargeYet')}</p>
    </div>
  )
}
