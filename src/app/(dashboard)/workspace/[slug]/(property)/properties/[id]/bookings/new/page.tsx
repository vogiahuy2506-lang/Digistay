'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Banknote, Bed, Check, Clock, CreditCard, Landmark, Plus, RefreshCw, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Header, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { getIcon } from '@/lib/amenity-icons'
import { addDays, vnDay } from '@/lib/bookings/room-plan'
import { nightsBetween } from '@/lib/bookings/display'
import type { Rates } from '@/lib/pricing/quote'
import { resizedImage } from '@/lib/media/image-url'
import { routes } from '@/lib/utils/routes'
import { cn } from '@/lib/utils'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'

/** A room type as GET /api/bookings/availability returns it (all=1): the hotel's own data and price for these dates and guests. */
interface RoomType {
  id: string
  name: string
  description: string | null
  area: number | null
  bedType: string
  baseOccupancy: number
  maxOccupancy: number
  maxAdults: number
  maxChildren: number
  totalRooms: number
  availableRooms: number
  isAvailable: boolean
  /** takes these adults and children */
  fits: boolean
  image: string | null
  amenities: { id: string; name: string; icon: string | null }[]
  /** room nights (basePrice) and with the surcharges for these guests (total), as the booking is charged */
  pricing: Rates & { basePrice: number; total: number }
}

/** One of the hotel's listed rooms free on these nights (GET /api/rooms/available). */
interface Room {
  id: string
  number: string
  floor: number | null
}

type Method = 'NONE' | 'CASH' | 'CARD' | 'QR_VIETQR'
type Recorded = { ok: boolean; pending?: boolean; error?: string }

const BED_TYPES = ['SINGLE', 'DOUBLE', 'TWIN', 'TRIPLE', 'QUADRUPLE', 'KING', 'QUEEN', 'SUITE', 'BUNK'] as const

/** "26/10" of a yyyy-mm-dd day. */
const dayMonth = (day: string) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : '')

/**
 * Walk-in (front desk): a booking for a guest at the desk. Everything shown
 * is the hotel's: rooms free for the dates and guests chosen
 * (/api/bookings/availability, the count the booking checks), each type's
 * own area, beds, amenities and price, its free rooms when it has a room
 * list. The booking goes through POST /api/bookings; money collected now is
 * recorded through POST /api/payments (cash and a POS card are money in
 * hand; a transfer waits for confirmation in Payments). The page used to
 * show made-up figures, a countdown that held nothing and buttons that did
 * nothing.
 */
export default function WalkinBookingPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const t = useTranslations('dash.bookings.walkIn')
  const labels = useDashLabels()

  // Vietnam days: the same on the server and in the browser.
  const [checkInDate, setCheckInDate] = React.useState(() => vnDay(new Date()))
  const [checkOutDate, setCheckOutDate] = React.useState(() => addDays(vnDay(new Date()), 1))
  const [numAdults, setNumAdults] = React.useState(2)
  const [numChildren, setNumChildren] = React.useState(0)
  const [stayTimes, setStayTimes] = React.useState<{ checkIn: string; checkOut: string } | null>(null)

  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [searchKey, setSearchKey] = React.useState(0)
  const [selectedTypeId, setSelectedTypeId] = React.useState<string | null>(null)
  // null: loading; listed false: the type has no room list.
  const [rooms, setRooms] = React.useState<{ listed: boolean; list: Room[] } | null>(null)
  const [roomId, setRoomId] = React.useState('')

  const [guest, setGuest] = React.useState({ name: '', phone: '', email: '', note: '' })
  const [method, setMethod] = React.useState<Method>('NONE')
  const [scope, setScope] = React.useState<'full' | 'deposit'>('full')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  // The hotel's check-in / check-out times.
  React.useEffect(() => {
    fetch(`/api/properties/${propertyId}/policy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.data && setStayTimes({ checkIn: d.data.checkInTime, checkOut: d.data.checkOutTime }))
      .catch(() => {})
  }, [propertyId])

  // Every priced room type for these dates and guests; the list shows those that fit and have a room free.
  React.useEffect(() => {
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return
    const controller = new AbortController()
    setIsLoading(true)
    setError('')
    const query = new URLSearchParams({
      propertyId,
      checkInDate,
      checkOutDate,
      numAdults: String(numAdults),
      numChildren: String(numChildren),
      all: '1',
    })
    fetch(`/api/bookings/availability?${query}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (controller.signal.aborted) return
        if (data.success) setRoomTypes(data.data)
        else setError(apiError(data.error) || t('search.searchError'))
      })
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') setError(t('search.connectionError'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [propertyId, checkInDate, checkOutDate, numAdults, numChildren, searchKey, t])

  const offered = roomTypes.filter((rt) => rt.fits && rt.isAvailable)
  const selected = offered.find((rt) => rt.id === selectedTypeId) ?? null
  const vacancy = roomTypes.reduce((sum, rt) => ({ available: sum.available + rt.availableRooms, total: sum.total + rt.totalRooms }), { available: 0, total: 0 })

  // The chosen type's free rooms, once it has a room list.
  React.useEffect(() => {
    setRoomId('')
    if (!selectedTypeId) return setRooms(null)
    const controller = new AbortController()
    setRooms(null)
    const query = new URLSearchParams({ propertyId, roomTypeId: selectedTypeId, checkIn: checkInDate, checkOut: checkOutDate })
    fetch(`/api/rooms/available?${query}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return
        // Without a list the API makes up numbered slots: not rooms of the hotel, so not offered.
        const list: Room[] = data?.success && data.meta?.listed ? data.data : []
        setRooms({ listed: !!(data?.success && data.meta?.listed), list })
        if (list[0]) setRoomId(list[0].id)
      })
      .catch(() => {
        if (!controller.signal.aborted) setRooms({ listed: false, list: [] })
      })
    return () => controller.abort()
  }, [propertyId, selectedTypeId, checkInDate, checkOutDate])

  const nights = checkOutDate > checkInDate ? nightsBetween(`${checkInDate}T00:00:00Z`, `${checkOutDate}T00:00:00Z`) : 0
  const total = selected?.pricing.total ?? 0
  const roomCharge = selected?.pricing.basePrice ?? 0
  const amountNow = scope === 'full' ? total : Math.round(total / 2)
  const room = rooms?.list.find((r) => r.id === roomId) ?? null

  const bedTypeLabel = (bedType: string) =>
    BED_TYPES.includes(bedType as never) ? t(`bedTypes.${bedType as (typeof BED_TYPES)[number]}`) : bedType

  const resetForm = () => {
    setSelectedTypeId(null)
    setGuest({ name: '', phone: '', email: '', note: '' })
    setMethod('NONE')
    setScope('full')
    setError('')
  }

  /** Records what is collected now (POST /api/payments); a POS card is confirmed at once: the money is in. */
  const recordPayment = async (bookingId: string, amount: number): Promise<Recorded> => {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, method, amount }),
    })
    const data = await res.json().catch(() => null)
    if (!data?.success) return { ok: false, error: apiError(data?.error) }
    if (method === 'QR_VIETQR') return { ok: true, pending: true }
    if (method === 'CARD') {
      const confirmed = await fetch(`/api/payments/${data.data.id}/confirm`, { method: 'POST' })
      const body = await confirmed.json().catch(() => null)
      if (!body?.success) return { ok: false, error: apiError(body?.error) }
    }
    return { ok: true }
  }

  const handleSubmit = async () => {
    if (!guest.name.trim() || !guest.phone.trim()) {
      setError(t('summary.missingGuest'))
      return
    }
    if (!selected) return
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomTypeId: selected.id,
          guestName: guest.name.trim(),
          guestPhone: guest.phone.trim(),
          guestEmail: guest.email.trim(),
          guestNote: guest.note.trim() || undefined,
          checkInDate,
          checkOutDate,
          numAdults,
          numChildren,
          ...(room && { roomId: room.id }),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(apiError(data.error) || t('summary.bookingFailed'))
        return
      }
      const booking = data.data as { id: string; bookingCode: string; totalAmount: number }
      // The server's total (quote.ts), not the page's.
      const amount = scope === 'full' ? booking.totalAmount : Math.round(booking.totalAmount / 2)
      if (method !== 'NONE' && amount > 0) {
        const paid = await recordPayment(booking.id, amount).catch((): Recorded => ({ ok: false }))
        if (!paid.ok) toast.error(t('done.paymentFailed', { code: booking.bookingCode }), paid.error)
        else if (paid.pending) toast.success(t('done.pending', { code: booking.bookingCode, amount: labels.money(amount) }))
        else toast.success(t('done.paid', { code: booking.bookingCode, amount: labels.money(amount) }))
      } else {
        toast.success(t('done.created', { code: booking.bookingCode }))
      }
      router.push(routes.propertyBooking(params.slug, propertyId, booking.id))
    } catch {
      setError(t('search.connectionError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const field = 'block w-full h-10 sm:h-9 px-3 rounded-ctl border border-line bg-panel text-base sm:text-small text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-acc/30 focus-visible:border-acc'
  const methods: { value: Method; label: string; icon: React.ReactNode }[] = [
    { value: 'NONE', label: t('summary.payLater'), icon: <Clock className="w-4 h-4" aria-hidden="true" /> },
    { value: 'CASH', label: t('summary.cash'), icon: <Banknote className="w-4 h-4" aria-hidden="true" /> },
    { value: 'CARD', label: t('summary.posCard'), icon: <CreditCard className="w-4 h-4" aria-hidden="true" /> },
    { value: 'QR_VIETQR', label: t('summary.transfer'), icon: <Landmark className="w-4 h-4" aria-hidden="true" /> },
  ]

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={t('intro')}
        actions={
          <Link
            href={routes.propertyCalendar(params.slug, propertyId)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-ctl border border-line bg-panel text-small font-medium text-fg hover:bg-fg/5"
          >
            <ArrowLeft className="w-4 h-4 text-muted" aria-hidden="true" />
            {t('backToCalendar')}
          </Link>
        }
      />

      {/* Dates and guests; the list follows them. */}
      <section className="bg-panel rounded-box border border-line p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_8rem_auto] gap-3 items-end">
          <div>
            <label htmlFor="walkin-in" className="flex justify-between gap-2 text-small font-medium text-fg mb-1.5">
              {t('search.checkIn')}
              {stayTimes && <span className="text-xs font-normal text-muted">{t('search.from', { time: stayTimes.checkIn })}</span>}
            </label>
            <input
              id="walkin-in"
              type="date"
              value={checkInDate}
              onChange={(e) => {
                const next = e.target.value
                if (!next) return
                setCheckInDate(next)
                setCheckOutDate((prev) => (!prev || prev <= next ? addDays(next, 1) : prev))
              }}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="walkin-out" className="flex justify-between gap-2 text-small font-medium text-fg mb-1.5">
              {t('search.checkOut')}
              {stayTimes && <span className="text-xs font-normal text-muted">{t('search.until', { time: stayTimes.checkOut })}</span>}
            </label>
            <input
              id="walkin-out"
              type="date"
              value={checkOutDate}
              min={addDays(checkInDate, 1)}
              onChange={(e) => e.target.value && setCheckOutDate(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="walkin-adults" className="block text-small font-medium text-fg mb-1.5">{t('search.adults')}</label>
            <select id="walkin-adults" value={numAdults} onChange={(e) => setNumAdults(Number(e.target.value))} className={field}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="walkin-children" className="block text-small font-medium text-fg mb-1.5">{t('search.children')}</label>
            <select id="walkin-children" value={numChildren} onChange={(e) => setNumChildren(Number(e.target.value))} className={field}>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 lg:col-span-1 flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            <p className="text-small text-muted lg:text-right">
              {t('vacancy', { from: dayMonth(checkInDate), to: dayMonth(checkOutDate) })}
              <span className="block font-semibold text-fg tabular-nums">
                {isLoading ? '…' : t('vacancyCount', { available: vacancy.available, total: vacancy.total })}
              </span>
            </p>
            <Button variant="outline" size="sm" onClick={() => setSearchKey((k) => k + 1)} isLoading={isLoading}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              {t('search.refresh')}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Room types with a room free */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-body font-semibold text-fg flex items-center gap-2">
              {t('rooms.title')}
              <span className="text-xs font-medium text-muted tabular-nums">{t('rooms.typeCount', { count: offered.length })}</span>
            </h2>
            <span className="text-xs text-muted">{t('rooms.priceNote')}</span>
          </div>

          {isLoading && roomTypes.length === 0 ? (
            <p className="bg-panel rounded-box border border-line p-12 text-center text-small text-muted">{t('rooms.searching')}</p>
          ) : offered.length === 0 ? (
            <div className="bg-panel rounded-box border border-line p-12 text-center">
              <Bed className="w-10 h-10 mx-auto text-muted mb-3" aria-hidden="true" />
              <p className="text-small text-muted">{t('rooms.none')}</p>
            </div>
          ) : (
            offered.map((roomType) => {
              const isSelected = selected?.id === roomType.id
              return (
                <article
                  key={roomType.id}
                  className={cn('bg-panel rounded-box overflow-hidden border transition-colors', isSelected ? 'border-acc ring-1 ring-acc' : 'border-line')}
                >
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                    <div className="relative w-full sm:w-36 h-32 sm:h-28 shrink-0 overflow-hidden rounded-ctl bg-acc-soft/60 flex items-center justify-center">
                      {roomType.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resizedImage(roomType.image, 480)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Bed className="w-10 h-10 text-acc/40" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <h3 className="text-body font-semibold text-fg">{roomType.name}</h3>
                          <p className="text-xs text-muted mt-0.5">
                            {[bedTypeLabel(roomType.bedType), roomType.area ? t('rooms.area', { area: roomType.area }) : null].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-body font-semibold text-fg tabular-nums">{labels.money(roomType.pricing.weekdayPrice)}</span>
                          <span className="text-xs text-muted"> {t('rooms.perNight')}</span>
                        </div>
                      </div>

                      <ul className="flex flex-wrap items-center gap-1.5 mt-3 text-xs text-fg">
                        <li className="inline-flex items-center gap-1 rounded-full bg-ok-soft text-ok px-2 py-0.5 font-medium">
                          {t('rooms.left', { count: roomType.availableRooms })}
                        </li>
                        <li className="inline-flex items-center gap-1 rounded-full bg-fg/5 px-2 py-0.5">
                          <Users className="w-3 h-3 text-muted" aria-hidden="true" />
                          {t('rooms.capacity', { count: roomType.maxOccupancy })} ({labels.guests(roomType.maxAdults, roomType.maxChildren)})
                        </li>
                        {roomType.amenities.slice(0, 4).map((a) => {
                          const Icon = getIcon(a.icon)
                          return (
                            <li key={a.id} className="inline-flex items-center gap-1 rounded-full bg-fg/5 px-2 py-0.5">
                              <Icon className="w-3 h-3 text-muted" aria-hidden="true" />
                              {a.name}
                            </li>
                          )
                        })}
                        {roomType.amenities.length > 4 && <li className="rounded-full bg-fg/5 px-2 py-0.5 text-muted">+{roomType.amenities.length - 4}</li>}
                      </ul>

                      <div className="mt-4 pt-3 border-t border-line flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        {isSelected ? (
                          <div className="min-w-0 flex-1">
                            {rooms === null ? (
                              <p className="text-small text-muted">{t('rooms.loadingRooms')}</p>
                            ) : rooms.listed ? (
                              <div className="sm:max-w-[16rem]">
                                <label htmlFor="walkin-room" className="block text-small font-medium text-fg mb-1.5">{t('rooms.room')}</label>
                                <select id="walkin-room" value={roomId} onChange={(e) => setRoomId(e.target.value)} className={field}>
                                  <option value="">{t('rooms.later')}</option>
                                  {rooms.list.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.floor !== null ? t('rooms.roomOptionFloor', { number: r.number, floor: r.floor }) : t('rooms.roomOption', { number: r.number })}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <p className="text-xs text-muted">{t('rooms.noList')}</p>
                            )}
                          </div>
                        ) : (
                          <span />
                        )}
                        <Button
                          size="sm"
                          variant={isSelected ? 'primary' : 'outline'}
                          onClick={() => setSelectedTypeId(roomType.id)}
                          aria-pressed={isSelected}
                          className="w-full sm:w-auto shrink-0"
                        >
                          {isSelected ? <Check className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />}
                          {isSelected ? t('rooms.chosen') : t('rooms.choose')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })
          )}
          {!isLoading && roomTypes.length > offered.length && (
            <p className="text-xs text-muted">{t('rooms.hidden', { count: roomTypes.length - offered.length })}</p>
          )}
        </div>

        {/* The booking */}
        <aside className="lg:col-span-5 lg:sticky lg:top-20 min-w-0">
          <div className="bg-panel rounded-box border border-line">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-body font-semibold text-fg">{t('summary.title')}</h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="rounded-ctl bg-fg/[0.03] border border-line p-3 text-small">
                {selected ? (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-fg min-w-0">
                      {room ? t('summary.roomLine', { roomType: selected.name, number: room.number }) : t('summary.roomLater', { roomType: selected.name })}
                    </p>
                    <span className="text-xs text-muted shrink-0">{t('summary.nights', { count: nights })}</span>
                  </div>
                ) : (
                  <p className="text-muted text-center">{t('summary.noRoom')}</p>
                )}
                <dl className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <dt className="text-muted">{t('summary.checkIn')}</dt>
                    <dd className="font-medium text-fg tabular-nums">{dayMonth(checkInDate)}{stayTimes ? ` · ${stayTimes.checkIn}` : ''}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t('summary.checkOut')}</dt>
                    <dd className="font-medium text-fg tabular-nums">{dayMonth(checkOutDate)}{stayTimes ? ` · ${stayTimes.checkOut}` : ''}</dd>
                  </div>
                </dl>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-small font-medium text-fg mb-2">{t('summary.guestInfo')}</legend>
                <input className={field} placeholder={t('summary.namePlaceholder')} aria-label={t('summary.namePlaceholder')} value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} autoComplete="off" />
                <input className={field} placeholder={t('summary.phonePlaceholder')} aria-label={t('summary.phonePlaceholder')} value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} type="tel" autoComplete="off" />
                <input className={field} placeholder={t('summary.emailPlaceholder')} aria-label={t('summary.emailPlaceholder')} value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} type="email" autoComplete="off" />
                <textarea
                  className={cn(field, 'h-auto py-2')}
                  rows={2}
                  placeholder={t('summary.notePlaceholder')}
                  aria-label={t('summary.notePlaceholder')}
                  value={guest.note}
                  onChange={(e) => setGuest({ ...guest, note: e.target.value })}
                />
              </fieldset>

              {selected && (
                <div className="space-y-1.5 text-small">
                  <div className="flex justify-between gap-3 text-muted">
                    <span>{t('summary.roomCharge', { count: nights })}</span>
                    <span className="text-fg tabular-nums">{labels.money(roomCharge)}</span>
                  </div>
                  {total > roomCharge && (
                    <div className="flex justify-between gap-3 text-muted">
                      <span>{t('summary.extraGuests')}</span>
                      <span className="text-fg tabular-nums">{labels.money(total - roomCharge)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-line flex justify-between items-baseline gap-3">
                    <span className="font-semibold text-fg">
                      {t('summary.total')} <span className="text-xs font-normal text-muted">{t('summary.vatIncluded')}</span>
                    </span>
                    <span className="text-lg font-semibold text-fg tabular-nums">{labels.money(total)}</span>
                  </div>
                </div>
              )}

              <fieldset>
                <legend className="text-small font-medium text-fg mb-2">{t('summary.paymentMethod')}</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label={t('summary.paymentMethod')}>
                  {methods.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={method === m.value}
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        'h-14 rounded-ctl border flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                        method === m.value ? 'border-acc bg-acc-soft text-fg' : 'border-line bg-panel text-muted hover:text-fg'
                      )}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                {method !== 'NONE' && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-small" role="radiogroup">
                    {(['full', 'deposit'] as const).map((value) => (
                      <label key={value} className="inline-flex items-center gap-2 cursor-pointer text-fg">
                        <input type="radio" name="walkin-scope" checked={scope === value} onChange={() => setScope(value)} className="h-4 w-4" />
                        {value === 'full' ? t('summary.payFull') : t('summary.deposit')}
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">
                  {method === 'NONE'
                    ? t('summary.laterNote')
                    : method === 'QR_VIETQR'
                      ? t('summary.transferNote')
                      : selected
                        ? t('summary.collectNow', { amount: labels.money(amountNow) })
                        : null}
                </p>
              </fieldset>

              {error && (
                <p className="p-3 rounded-ctl bg-err-soft text-err text-small flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="ghost" onClick={resetForm} className="sm:w-auto">
                  {t('summary.reset')}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={!selected || !guest.name.trim() || !guest.phone.trim()}
                >
                  {t('summary.submit')}
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </PageContainer>
  )
}
