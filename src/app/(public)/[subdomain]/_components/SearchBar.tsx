'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import { nightsBetween } from '@/lib/bookings/display'
import { useSiteHref } from './site-base'

/** Today in Vietnam time, as yyyy-mm-dd (what <input type="date"> takes). */
function vnDay(offsetDays = 0): string {
  return new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10)
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  const btn =
    'flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg hover:border-muted disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
  return (
    <div className="px-4 py-3 sm:px-5">
      <span className="block text-label uppercase text-muted">
        {label}
        {hint && <span className="normal-case tracking-normal"> ({hint})</span>}
      </span>
      <div className="mt-1.5 flex items-center gap-3">
        <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Giảm ${label.toLowerCase()}`}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="w-6 text-center text-body tabular-nums text-fg" aria-live="polite">
          {value}
        </span>
        <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Tăng ${label.toLowerCase()}`}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** "Tìm phòng" bar (redesign 3a): dates, adults, children; opens the search page. */
export function SearchBar() {
  const router = useRouter()
  const href = useSiteHref()
  const [checkIn, setCheckIn] = useState(vnDay(0))
  const [checkOut, setCheckOut] = useState(vnDay(1))
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)

  const nights = nightsBetween(`${checkIn}T12:00:00+07:00`, `${checkOut}T12:00:00+07:00`)
  const valid = !!checkIn && !!checkOut && nights > 0

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    // The search page takes the total guest count.
    const params = new URLSearchParams({ checkIn, checkOut, guests: String(adults + children) })
    router.push(href(`/search?${params.toString()}`))
  }

  const dateField = (label: string, value: string, min: string, onChange: (v: string) => void) => (
    <label className="block px-4 py-3 sm:px-5">
      <span className="block text-label uppercase text-muted">{label}</span>
      <input
        type="date"
        required
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-body text-fg focus:outline-none [color-scheme:light]"
      />
    </label>
  )

  return (
    <form onSubmit={onSubmit} aria-label="Tìm phòng trống">
      <div className="grid grid-cols-2 border border-line bg-panel shadow-lift lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:divide-x lg:divide-line [&>*]:border-line max-lg:[&>*:nth-child(odd)]:border-r max-lg:[&>*:nth-child(-n+4)]:border-b">
        {dateField('Ngày nhận', checkIn, vnDay(0), (v) => {
          setCheckIn(v)
          if (v >= checkOut) setCheckOut(new Date(new Date(`${v}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10))
        })}
        {dateField('Ngày trả', checkOut, checkIn || vnDay(1), setCheckOut)}
        <Stepper label="Người lớn" value={adults} min={1} max={20} onChange={setAdults} />
        <Stepper label="Trẻ em" value={children} min={0} max={10} onChange={setChildren} />
        <button
          type="submit"
          disabled={!valid}
          className="col-span-2 lg:col-span-1 h-14 lg:h-auto px-8 bg-ink text-on-ink text-body font-medium hover:bg-ink/90 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2"
        >
          Tìm phòng
        </button>
      </div>
      <p className="mt-3 text-small text-muted">
        {valid ? `${nights} đêm · ${adults} người lớn${children ? ` · ${children} trẻ em` : ''}` : 'Ngày trả phải sau ngày nhận'}
      </p>
    </form>
  )
}
