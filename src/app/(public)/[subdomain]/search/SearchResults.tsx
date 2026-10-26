'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { formatVnd } from '@/lib/bookings/display'
import { nightsOf } from '@/lib/pricing/quote'
import { cn } from '@/lib/utils'
import { responsiveImage } from '@/lib/media/image-url'
import { SiteLink, useSiteHref } from '../_components/site-base'
import { Container, PhotoPlaceholder, bedLabel } from '../_components/site-ui'
import { stayDate } from '../_components/booking/StaySummary'

interface Result {
  id: string
  name: string
  area: number | null
  bedType: string
  maxAdults: number
  maxChildren: number
  availableRooms: number
  fits: boolean
  image: string | null
  amenities: { id: string; name: string }[]
  pricing: { total: number; weekdayPrice: number; weekendPrice: number }
}

export interface StayQuery {
  checkIn: string
  checkOut: string
  adults: number
  children: number
}

const queryString = (q: StayQuery) =>
  new URLSearchParams({ checkIn: q.checkIn, checkOut: q.checkOut, adults: String(q.adults), children: String(q.children) }).toString()

/**
 * Rooms free for a stay (Claude Design "Digistay Ket Qua Tim Phong"): each
 * room type with the price of the whole stay, what is left, and why one
 * cannot be booked (too small for the guests, sold out). Room types too
 * small still show (availability API, all=1), marked.
 */
export function SearchResults({
  propertyId,
  phone,
  checkInTime,
  checkOutTime,
  initial,
}: {
  propertyId: string
  phone: string | null
  checkInTime: string
  checkOutTime: string
  initial: StayQuery
}) {
  const t = useTranslations('site')
  const locale = useLocale()
  const lang = locale === 'en' ? 'en' : 'vi'
  const router = useRouter()
  const href = useSiteHref()
  const [form, setForm] = React.useState<StayQuery>(initial)
  const [query, setQuery] = React.useState<StayQuery>(initial)
  const [results, setResults] = React.useState<Result[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const dateRef = React.useRef<HTMLInputElement>(null)

  const validDates = form.checkOut > form.checkIn

  React.useEffect(() => {
    let live = true
    setLoading(true)
    setError(false)
    const params = new URLSearchParams({
      propertyId,
      checkInDate: query.checkIn,
      checkOutDate: query.checkOut,
      numAdults: String(query.adults),
      numChildren: String(query.children),
      all: '1',
      locale: lang,
    })
    fetch(`/api/bookings/availability?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!live) return
        if (data.success) setResults(data.data)
        else setError(true)
      })
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [propertyId, query, lang])

  const search = (next: StayQuery) => {
    setForm(next)
    setQuery(next)
    router.replace(href(`/search?${queryString(next)}`), { scroll: false })
  }

  const nights = nightsOf(new Date(`${query.checkIn}T00:00:00+07:00`), new Date(`${query.checkOut}T00:00:00+07:00`))
  const nightsText = t('units.nights', { count: nights.nights })
  const guestsText = (a: number, c: number) =>
    [t('units.adults', { count: a }), ...(c > 0 ? [t('units.children', { count: c })] : [])].join(', ')
  const capacity = (r: { maxAdults: number; maxChildren: number }) =>
    r.maxChildren > 0
      ? t('room.maxGuestsWithChildren', { adults: r.maxAdults, children: r.maxChildren })
      : t('room.maxGuests', { adults: r.maxAdults })

  const fitting = (results ?? []).filter((r) => r.fits)
  const showNoFit = !loading && !error && results !== null && results.length > 0 && fitting.length === 0
  const allSold = !loading && !error && fitting.length > 0 && fitting.every((r) => r.availableRooms === 0)
  const largest = (results ?? []).reduce<Result | null>((best, r) => (!best || r.maxAdults + r.maxChildren > best.maxAdults + best.maxChildren ? r : best), null)

  const stepper = (label: string, value: number, min: number, max: number, set: (n: number) => void) => (
    <div className="border-b border-line px-5 py-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-[18px]">
      <p className="text-label uppercase text-muted">{label}</p>
      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => set(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={t('stay.decrease', { what: label.toLowerCase() })}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel text-[16px] disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-[14px] text-center text-[18px] font-medium tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => set(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={t('stay.increase', { what: label.toLowerCase() })}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel text-[16px] disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )

  const dateCell = (which: 'checkIn' | 'checkOut') => (
    <label className="block cursor-pointer border-b border-line px-5 py-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-[18px]">
      <span className="text-label uppercase text-muted">{which === 'checkIn' ? t('stay.checkIn') : t('stay.checkOut')}</span>
      <input
        ref={which === 'checkIn' ? dateRef : undefined}
        type="date"
        value={form[which]}
        min={which === 'checkOut' ? form.checkIn : undefined}
        onChange={(e) => setForm((f) => ({ ...f, [which]: e.target.value }))}
        className="mt-1.5 block w-full bg-transparent text-[16px] font-medium text-fg focus:outline-none"
      />
      <span className="mt-0.5 block text-[12.5px] text-muted">
        {which === 'checkIn' ? t('booking.common.checkInFrom', { time: checkInTime }) : t('booking.common.checkOutBy', { time: checkOutTime })}
      </span>
    </label>
  )

  return (
    <>
      <Container className="pt-6 lg:pt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (validDates) search(form)
          }}
          aria-label={t('stay.searchLabel')}
          className="grid border border-line bg-panel lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
        >
          {dateCell('checkIn')}
          {dateCell('checkOut')}
          {stepper(t('stay.adults'), form.adults, 1, 20, (adults) => setForm((f) => ({ ...f, adults })))}
          {stepper(t('stay.children'), form.children, 0, 10, (children) => setForm((f) => ({ ...f, children })))}
          <button
            type="submit"
            disabled={!validDates || loading}
            className="h-14 bg-ink px-10 text-[15px] font-medium text-on-ink transition-colors hover:bg-ink/90 disabled:opacity-70 lg:h-auto lg:min-w-[200px]"
          >
            {loading ? t('booking.search.searching') : t('booking.search.update')}
          </button>
        </form>
        {!validDates && <p className="mt-2 text-[13px] text-err">{t('stay.checkOutAfterCheckIn')}</p>}
      </Container>

      <Container className="mt-10 flex flex-col gap-3 lg:mt-14 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div>
          <h1 className="font-site text-[32px] leading-[1.15] text-fg lg:text-[44px]">{t('booking.search.title')}</h1>
          <p className="mt-2 text-[15px] text-muted lg:mt-3">
            {stayDate(query.checkIn, locale, false)} → {stayDate(query.checkOut, locale, false)} · {nightsText} · {guestsText(query.adults, query.children)}
          </p>
        </div>
        <p className="max-w-[400px] text-[13px] leading-[1.6] text-muted lg:text-right">{t('booking.search.note')}</p>
      </Container>

      <Container className="mt-6 flex flex-col gap-5 lg:mt-8">
        {loading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid animate-pulse border border-line bg-panel lg:grid-cols-[400px_minmax(0,1fr)_320px]">
                <div className="aspect-[16/9] bg-plain-soft lg:aspect-auto lg:min-h-[240px]" />
                <div className="flex flex-col gap-3.5 p-6 lg:p-8">
                  <div className="h-7 w-[55%] bg-plain-soft" />
                  <div className="h-3.5 w-[75%] bg-plain-soft/70" />
                  <div className="h-3.5 w-[40%] bg-plain-soft/70" />
                </div>
                <div className="flex flex-col justify-between gap-6 border-t border-line p-6 lg:border-l lg:border-t-0 lg:px-7 lg:py-8">
                  <div className="h-7 w-[70%] bg-plain-soft" />
                  <div className="h-[50px] bg-plain-soft" />
                </div>
              </div>
            ))}
            <p className="text-center text-[13px] text-muted">{t('booking.search.loading')}</p>
          </>
        )}

        {error && <p className="border border-line bg-panel px-6 py-5 text-[15px] text-fg">{t('booking.search.error')}</p>}

        {!loading && !error && results?.length === 0 && (
          <p className="border border-line bg-panel px-6 py-5 text-[15px] text-fg">{t('booking.search.empty')}</p>
        )}

        {showNoFit && largest && (
          <div className="grid gap-4 bg-warn-soft px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-7 lg:py-6">
            <div>
              <p className="text-[17px] font-semibold text-fg">{t('booking.search.noFitTitle', { guests: guestsText(query.adults, query.children) })}</p>
              <p className="mt-1.5 max-w-[760px] text-[14px] leading-[1.6] text-fg/80">{t('booking.search.noFitText', { largest: capacity(largest) })}</p>
            </div>
            <div className="flex flex-wrap gap-2.5 lg:justify-end">
              <button
                type="button"
                onClick={() => search({ ...query, adults: Math.min(query.adults, largest.maxAdults), children: Math.min(query.children, largest.maxChildren) })}
                className="h-[46px] bg-ink px-5 text-[14px] font-medium text-on-ink"
              >
                {t('booking.search.useLargest', { largest: capacity(largest) })}
              </button>
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex h-[46px] items-center border border-ink px-[18px] text-[14px] font-medium text-fg">
                  {t('booking.common.call', { phone })}
                </a>
              )}
            </div>
          </div>
        )}

        {allSold && (
          <div className="border border-line bg-panel p-6 lg:p-10">
            <p className="text-label font-medium uppercase text-muted">{t('booking.search.soldLabel')}</p>
            <h2 className="mt-3 font-site text-[26px] leading-tight text-fg lg:text-[32px]">
              {t('booking.search.soldTitle', { from: stayDate(query.checkIn, locale, false), to: stayDate(query.checkOut, locale, false) })}
            </h2>
            <p className="mt-3 max-w-[520px] text-[15px] leading-[1.7] text-muted">{t('booking.search.soldText')}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  dateRef.current?.focus()
                  dateRef.current?.showPicker?.()
                }}
                className="h-[46px] bg-ink px-5 text-[14px] font-medium text-on-ink"
              >
                {t('booking.search.otherDates')}
              </button>
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex h-[46px] items-center border border-ink px-5 text-[14px] font-medium text-fg">
                  {t('booking.common.call', { phone })}
                </a>
              )}
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          (results ?? []).map((r) => {
            const sold = r.availableRooms === 0
            const breakdown =
              nights.weekendNights > 0 && r.pricing.weekendPrice !== r.pricing.weekdayPrice
                ? t('booking.common.breakdown', {
                    weekday: nights.weekdayNights,
                    weekdayPrice: formatVnd(r.pricing.weekdayPrice, lang),
                    weekend: nights.weekendNights,
                    weekendPrice: formatVnd(r.pricing.weekendPrice, lang),
                  })
                : t('booking.common.weekdayOnly', { nights: nightsText, price: formatVnd(r.pricing.weekdayPrice, lang) })
            const spec = t('booking.search.spec', {
              area: r.area ? t('units.area', { area: r.area }) : '—',
              bed: bedLabel(r.bedType, t),
              capacity: capacity(r),
            })
            return (
              <article key={r.id} className="grid border border-line bg-panel lg:grid-cols-[400px_minmax(0,1fr)_320px]">
                <div className={cn('relative bg-plain-soft lg:aspect-auto lg:min-h-[260px]', r.image ? 'aspect-[16/10]' : 'h-28 lg:h-auto')}>
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- hotel photos from its own storage, any size
                    <img {...responsiveImage(r.image, '(min-width: 1024px) 400px, 100vw', { fallback: 800 })} alt={t('booking.common.photoOf', { name: r.name })} className={cn('absolute inset-0 h-full w-full object-cover', sold && 'opacity-50')} />
                  ) : (
                    // No photo yet: a small placeholder, not a ~300px grey block on phones.
                    <PhotoPlaceholder label={t('room.noPhoto')} className="absolute inset-0" />
                  )}
                  {sold && <span className="absolute left-3 top-3 bg-ink px-2.5 py-1 text-[12px] font-medium text-on-ink">{t('booking.search.soldBadge')}</span>}
                </div>
                <div className="flex min-w-0 flex-col gap-3 p-6 lg:gap-3.5 lg:px-8 lg:py-[30px]">
                  <h2 className="font-site text-[24px] leading-tight text-fg lg:text-[28px]">{r.name}</h2>
                  <p className="text-[14px] leading-[1.55] text-muted">{spec}</p>
                  {r.amenities.length > 0 && (
                    <ul className="flex flex-wrap gap-x-5 gap-y-2">
                      {r.amenities.slice(0, 3).map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-[13.5px] text-fg">
                          <span aria-hidden className="h-[5px] w-[5px] bg-acc" />
                          {a.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <SiteLink path={`/rooms/${r.id}?checkIn=${query.checkIn}&checkOut=${query.checkOut}`} className="mt-auto pt-2 text-[14px] font-medium text-acc hover:underline">
                    {t('booking.search.details')}
                  </SiteLink>
                </div>
                <div className="flex flex-col justify-between gap-6 border-t border-line p-6 lg:border-l lg:border-t-0 lg:px-7 lg:py-[30px]">
                  <div>
                    <p className="text-label uppercase text-muted">{t('booking.search.totalFor', { nights: nightsText })}</p>
                    <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-fg">{formatVnd(r.pricing.total, lang)}</p>
                    {nights.weekendNights > 0 && (
                      <p className="mt-2 text-[13px] leading-[1.55] text-muted">
                        {t('booking.search.nightsWeekend', { nights: nightsText, weekend: t('units.weekendNights', { count: nights.weekendNights }) })}
                      </p>
                    )}
                    <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">{breakdown}</p>
                  </div>
                  <div>
                    {!r.fits ? (
                      <>
                        <p className="mb-3 bg-warn-soft px-3 py-2 text-[13px] leading-[1.55] text-fg">{t('booking.search.noFit', { capacity: capacity(r) })}</p>
                        <button type="button" disabled className="h-[50px] w-full bg-plain-soft text-[15px] font-medium text-muted">
                          {t('booking.search.tooSmall')}
                        </button>
                      </>
                    ) : sold ? (
                      <>
                        <p className="mb-3 text-[13px] leading-[1.55] text-muted">{t('booking.search.soldRoom')}</p>
                        <button
                          type="button"
                          onClick={() => {
                            dateRef.current?.focus()
                            dateRef.current?.showPicker?.()
                          }}
                          className="h-[50px] w-full border border-ink text-[15px] font-medium text-fg"
                        >
                          {t('booking.search.otherDates')}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mb-3 text-[13px] font-semibold text-acc">
                          ● {r.availableRooms === 1 ? t('booking.search.lastOne') : t('booking.search.left', { count: r.availableRooms })}
                        </p>
                        <SiteLink
                          path={`/dat-phong?room=${r.id}&${queryString(query)}`}
                          className="flex h-[50px] items-center justify-center bg-ink text-[15px] font-medium text-on-ink transition-colors hover:bg-ink/90"
                        >
                          {t('booking.search.book')}
                        </SiteLink>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
      </Container>
    </>
  )
}
