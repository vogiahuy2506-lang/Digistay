'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import { formatVnd } from '@/lib/bookings/display'
import { quoteStay, type Rates } from '@/lib/pricing/quote'
import { useSiteHref } from '../../_components/site-base'

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
        <button type="button" className={stepBtn} onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Giảm ${name.toLowerCase()}`}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="text-body tabular-nums" aria-live="polite">{value}</span>
        <button type="button" className={stepBtn} onClick={() => set(value + 1)} disabled={value >= max} aria-label={`Tăng ${name.toLowerCase()}`}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )

  return (
    <div id="dat-phong" className="scroll-mt-24 border border-line bg-raised p-6 shadow-lift">
      {priced ? (
        <p className="text-[28px] leading-9 font-semibold tabular-nums text-fg">
          {formatVnd(priced.weekdayPrice)}
          <span className="text-small font-normal text-muted"> /đêm</span>
        </p>
      ) : (
        <p className="text-body font-medium text-fg">Liên hệ để biết giá</p>
      )}
      {priced && priced.weekendPrice !== priced.weekdayPrice ? (
        <p className="mt-1 text-small text-muted">Thứ Bảy, Chủ nhật: {formatVnd(priced.weekendPrice)}/đêm</p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 border border-line [&>*]:border-line [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b">
        <label className={cell}>
          <span className={label}>Ngày nhận</span>
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
          <span className={label}>Ngày trả</span>
          <input
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-1 w-full bg-transparent text-small text-fg focus:outline-none [color-scheme:light]"
          />
        </label>
        {stepper('Người lớn', adults, 1, Math.max(1, maxAdults), setAdults)}
        {stepper('Trẻ em', children, 0, Math.max(0, maxChildren), setChildren)}
      </div>

      {(adults >= maxAdults || (maxChildren > 0 && children >= maxChildren)) && (
        <p className="mt-3 bg-warn-soft px-3 py-2 text-small text-warn">
          Phòng này tối đa {maxAdults} người lớn{maxChildren > 0 ? ` + ${maxChildren} trẻ em` : ''}.
        </p>
      )}

      {estimate && (
        <dl className="mt-5 space-y-2 text-small">
          {estimate.weekdayNights > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                {formatVnd(priced!.weekdayPrice)} × {estimate.weekdayNights} đêm
              </dt>
              <dd className="tabular-nums text-fg">{formatVnd(estimate.weekdayNights * priced!.weekdayPrice)}</dd>
            </div>
          )}
          {estimate.weekendNights > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                {formatVnd(priced!.weekendPrice)} × {estimate.weekendNights} đêm cuối tuần
              </dt>
              <dd className="tabular-nums text-fg">{formatVnd(estimate.weekendNights * priced!.weekendPrice)}</dd>
            </div>
          )}
          {estimate.extraCharges > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Phụ thu khách thêm</dt>
              <dd className="tabular-nums text-fg">{formatVnd(estimate.extraCharges)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-line pt-3 text-body font-semibold">
            <dt className="text-fg">Tạm tính</dt>
            <dd className="tabular-nums text-fg">{formatVnd(estimate.total)}</dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        onClick={book}
        disabled={!validDates}
        className="mt-6 flex h-[52px] w-full items-center justify-center rounded-ctl bg-ink text-body font-medium text-on-ink hover:bg-ink/90 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2"
      >
        Đặt phòng
      </button>
      <p className="mt-3 text-center text-xs text-muted">Chưa trừ tiền ở bước này.</p>
    </div>
  )
}
