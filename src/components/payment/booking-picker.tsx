'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Select } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { remainingAmount } from '@/lib/bookings/display'

export interface PickedBooking {
  id: string
  bookingCode: string
  guestName: string
  guestPhone?: string | null
  guestEmail?: string | null
  status: string
  totalAmount: number
  /** everything paid so far (syncBookingPayments) */
  depositAmount: number
}

const PAGE = 20
const CLOSED = ['CANCELLED', 'NO_SHOW']

/** What is still owed on a booking (total minus what was paid). */
export const bookingBalance = (b: Pick<PickedBooking, 'totalAmount' | 'depositAmount'>) => remainingAmount(b)

/**
 * The booking field of "Tạo thanh toán" and "Tạo hóa đơn": the newest
 * bookings, and a search by booking code, guest name or phone that runs on
 * the server (GET /api/bookings?q=), so an older booking can be found too.
 * The choice stays in the list while the search changes.
 */
export function BookingPicker({
  propertyId,
  value,
  onChange,
  label,
  required,
  forPayment = false,
}: {
  propertyId: string
  value: string
  onChange: (booking: PickedBooking | null) => void
  label: string
  required?: boolean
  /** show what is owed, and refuse closed bookings (no payment can be taken) */
  forPayment?: boolean
}) {
  const t = useTranslations('dash.money.bookingPicker')
  const labels = useDashLabels()
  const selectId = React.useId()
  const hintId = React.useId()
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<PickedBooking[]>([])
  const [total, setTotal] = React.useState(0)
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [picked, setPicked] = React.useState<PickedBooking | null>(null)

  React.useEffect(() => {
    if (!propertyId) return
    let stale = false
    setState('loading')
    const q = query.trim()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ propertyId, limit: String(PAGE), ...(q && { q }) })
        const res = await fetch(`/api/bookings?${params}`)
        const data = await res.json()
        if (stale) return
        if (!data.success) throw new Error(data.error)
        setResults(data.data)
        setTotal(data.pagination?.total ?? data.data.length)
        setState('ready')
      } catch {
        if (!stale) setState('error')
      }
    }, q ? 300 : 0)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [propertyId, query])

  // A booking chosen before the search changed stays selectable.
  const current = value ? (results.find((b) => b.id === value) ?? (picked?.id === value ? picked : null)) : null
  const options = current && !results.some((b) => b.id === current.id) ? [current, ...results] : results

  const optionLabel = (b: PickedBooking) => {
    const parts = [b.bookingCode, b.guestName]
    if (CLOSED.includes(b.status)) parts.push(labels.bookingStatus(b.status))
    else if (forPayment) {
      const due = bookingBalance(b)
      parts.push(due > 0 ? t('balance', { amount: labels.money(due) }) : t('paidInFull'))
    }
    return parts.join(' · ')
  }

  const hint =
    state === 'loading'
      ? t('loading')
      : state === 'error'
        ? t('error')
        : query.trim()
          ? results.length === 0
            ? t('none')
            : t('found', { count: total })
          : total > results.length
            ? t('latest', { count: results.length })
            : null

  return (
    <div className="w-full">
      <label htmlFor={selectId} className="block text-small font-medium text-fg mb-1.5">
        {label}
        {required && (
          <span className="text-err ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('search')}
          aria-controls={selectId}
          placeholder={t('search')}
          className="w-full h-11 sm:h-10 rounded-ctl border border-line bg-panel pl-9 pr-3 text-base sm:text-small text-fg placeholder:text-muted hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:border-acc focus-visible:ring-acc/20"
        />
      </div>
      <Select
        id={selectId}
        required={required}
        value={value}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => {
          const booking = options.find((b) => b.id === e.target.value) ?? null
          setPicked(booking)
          onChange(booking)
        }}
      >
        <option value="">{t('choose')}</option>
        {options.map((b) => (
          <option key={b.id} value={b.id} disabled={forPayment && CLOSED.includes(b.status)}>
            {optionLabel(b)}
          </option>
        ))}
      </Select>
      {hint && (
        <p id={hintId} aria-live="polite" className={`mt-1.5 text-small ${state === 'error' ? 'text-err' : 'text-muted'}`}>
          {hint}
        </p>
      )}
    </div>
  )
}
