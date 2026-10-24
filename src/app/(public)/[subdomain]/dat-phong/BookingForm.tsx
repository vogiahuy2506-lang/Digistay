'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { formatVnd } from '@/lib/bookings/display'
import { depositFor, quoteStay, type PricedService, type Rates } from '@/lib/pricing/quote'
import { cn } from '@/lib/utils'
import { SiteLink, useSiteHref } from '../_components/site-base'
import { Container } from '../_components/site-ui'
import { StaySummary, type SummaryLine } from '../_components/booking/StaySummary'
import { apiError } from '@/lib/i18n/api-errors'

interface Service extends PricedService {
  description: string | null
}

const inputClass = (bad?: boolean) =>
  cn(
    'h-12 w-full border bg-panel px-3.5 text-[15px] text-fg placeholder:text-muted/80 focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60',
    bad ? 'border-err bg-err-soft/40' : 'border-line',
  )

/** sessionStorage key the confirmation page reads the guest's email from (never sent to the server again). */
export const guestEmailKey = (token: string) => `digistay:booking:${token.slice(0, 24)}`

/**
 * Step 2 (Claude Design "Digistay Dat Phong"): guest details, the hotel's
 * services, a company invoice, its policies and how the guest pays; the
 * stay and its price on the right, priced by src/lib/pricing/quote.ts like
 * the booking route. The room is held (/api/bookings/room-lock) while the
 * guest fills this in; the booking releases the hold.
 */
export function BookingForm({
  property,
  room,
  rates,
  stay,
  services,
  policies,
  times,
  deposit,
  backPath,
}: {
  property: { id: string; name: string; phone: string | null }
  room: { id: string; name: string; image: string | null; spec: string; baseOccupancy: number }
  rates: Rates
  stay: { checkIn: string; checkOut: string; adults: number; children: number }
  services: Service[]
  policies: { title: string; text: string }[]
  times: { checkIn: string; checkOut: string }
  deposit: { percent: number; deadlineMinutes: number } | null
  backPath: string
}) {
  const t = useTranslations('site')
  const tf = useTranslations('site.booking.form')
  const locale = useLocale()
  const lang = locale === 'en' ? 'en' : 'vi'
  const router = useRouter()
  const href = useSiteHref()
  const [guest, setGuest] = React.useState({ name: '', phone: '', email: '', note: '' })
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [invoice, setInvoice] = React.useState(false)
  const [vat, setVat] = React.useState({ company: '', taxCode: '', address: '', email: '' })
  const [tried, setTried] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [problem, setProblem] = React.useState<'roomGone' | 'badDates' | 'tooMany' | 'failed' | string | null>(null)
  const [wait, setWait] = React.useState(0)
  // Booked, but no link to the next pages (no signing secret on the server): the code here.
  const [bookedCode, setBookedCode] = React.useState<string | null>(null)
  const holdId = React.useRef<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  // Text typed before the page's script loaded is in the fields but not in
  // the state, and the next render would wipe it (seen on slow phones and in
  // e2e): keep it.
  React.useEffect(() => {
    const typed = (id: string) => formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value ?? ''
    setGuest((g) => ({
      name: g.name || typed('bk-name'),
      phone: g.phone || typed('bk-phone'),
      email: g.email || typed('bk-email'),
      note: g.note || typed('bk-note'),
    }))
  }, [])

  // Hold the room while the guest fills the form in.
  React.useEffect(() => {
    fetch('/api/bookings/room-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: property.id, roomTypeId: room.id, checkInDate: stay.checkIn, checkOutDate: stay.checkOut }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (data.success) holdId.current = data.data.lockId
        else if (res.status === 409) setProblem('roomGone')
      })
      .catch(() => {})
  }, [property.id, room.id, stay.checkIn, stay.checkOut])

  React.useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const chosen = services.filter((s) => (qty[s.id] ?? 0) > 0).map((service) => ({ service, quantity: qty[service.id] }))
  const quote = quoteStay({
    rates,
    checkIn: new Date(`${stay.checkIn}T00:00:00+07:00`),
    checkOut: new Date(`${stay.checkOut}T00:00:00+07:00`),
    numAdults: stay.adults,
    numChildren: stay.children,
    baseOccupancy: room.baseOccupancy,
    services: chosen,
  })
  const depositAmount = deposit ? depositFor(quote.total, deposit.percent) : 0
  const money = (n: number) => formatVnd(n, lang)
  const nightsText = t('units.nights', { count: quote.nights })

  const digits = guest.phone.replace(/\D/g, '').length
  const errors = {
    name: guest.name.trim().length < 2 && tf('nameError'),
    phone: (!/^[0-9+().\s-]*$/.test(guest.phone.trim()) || digits < 8 || digits > 15) && tf('phoneError'),
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(guest.email.trim()) && tf('emailError'),
    company: invoice && !vat.company.trim() && tf('companyError'),
    taxCode: invoice && !/^\d{10}(\d{3})?$/.test(vat.taxCode.replace(/[\s-]/g, '')) && tf('taxCodeError'),
    vatEmail: invoice && !!vat.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(vat.email.trim()) && tf('emailError'),
  }
  const shown = (k: keyof typeof errors) => (tried ? errors[k] : false)
  const errorCount = Object.values(errors).filter(Boolean).length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (errorCount > 0 || wait > 0) return
    setSending(true)
    setProblem(null)
    try {
      const res = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          roomTypeId: room.id,
          guestName: guest.name.trim(),
          guestPhone: guest.phone.trim(),
          guestEmail: guest.email.trim(),
          guestNote: guest.note.trim() || undefined,
          checkInDate: stay.checkIn,
          checkOutDate: stay.checkOut,
          numAdults: stay.adults,
          numChildren: stay.children,
          services: chosen.map((c) => ({ serviceId: c.service.id, quantity: c.quantity })),
          ...(holdId.current && { holdId: holdId.current }),
          ...(invoice && {
            vatCompany: vat.company.trim(),
            vatTaxCode: vat.taxCode.replace(/[\s-]/g, ''),
            vatAddress: vat.address.trim() || undefined,
            vatEmail: vat.email.trim(),
          }),
          // The guest's emails come in the page's language.
          locale: lang,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success && !data.data.token) {
        setBookedCode(data.data.bookingCode)
        setSending(false)
        return
      }
      if (res.ok && data.success) {
        try {
          sessionStorage.setItem(guestEmailKey(data.data.token), guest.email.trim())
        } catch {
          // Private mode: the confirmation just says "the email you entered".
        }
        router.push(href(`/${data.data.deposit ? 'dat-coc' : 'xac-nhan'}/${data.data.token}`))
        return
      }
      if (res.status === 429) {
        setProblem('tooMany')
        setWait(Number(res.headers.get('Retry-After')) || 60)
      } else if (res.status === 409) setProblem('roomGone')
      else if (res.status === 400 && /ngày/i.test(data.error ?? '')) setProblem('badDates')
      else setProblem(apiError(data.error) ?? 'failed')
      setSending(false)
    } catch {
      setProblem('failed')
      setSending(false)
    }
  }

  const lines: SummaryLine[] = [
    {
      label: t('booking.common.roomPrice', { nights: nightsText }),
      sub:
        quote.weekendNights > 0 && rates.weekendPrice !== rates.weekdayPrice
          ? t('booking.common.breakdown', {
              weekday: quote.weekdayNights,
              weekdayPrice: money(rates.weekdayPrice),
              weekend: quote.weekendNights,
              weekendPrice: money(rates.weekendPrice),
            })
          : undefined,
      amount: quote.basePrice,
    },
    ...(quote.extraAdultCharge + quote.extraChildCharge > 0
      ? [{ label: t('booking.common.extraGuests'), amount: quote.extraAdultCharge + quote.extraChildCharge }]
      : []),
    ...quote.services.map((s) => ({ label: `${s.name} × ${s.quantity}`, amount: s.amount })),
  ]
  const summary = (
    <StaySummary
      room={room}
      checkIn={stay.checkIn}
      checkOut={stay.checkOut}
      checkInTime={times.checkIn}
      checkOutTime={times.checkOut}
      nights={quote.nights}
      adults={stay.adults}
      childGuests={stay.children}
      lines={lines}
      total={quote.total}
      deposit={deposit ? { amount: depositAmount, paid: false } : null}
    />
  )

  const section = (n: string, title: string, children: React.ReactNode, lead?: string) => (
    <section className="border-t border-line pt-8 first:border-t-0 first:pt-0 lg:pt-10">
      <h2 className="flex items-baseline gap-3 font-site text-[24px] leading-tight text-fg lg:text-[28px]">
        <span className="font-mono text-[12px] font-medium text-muted">{n}</span>
        {title}
      </h2>
      {lead && <p className="mt-2 text-[14px] text-muted">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
  const field = (id: string, label: string, error: string | false, control: React.ReactNode, hint?: string, extra?: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-medium text-fg">
        {label} {extra && <span className="font-normal text-muted">{extra}</span>}
      </label>
      {control}
      {error ? <span className="text-[13px] text-err">⚠ {error}</span> : hint ? <span className="text-[13px] text-muted">{hint}</span> : null}
    </div>
  )
  const problemText =
    problem === 'roomGone'
      ? tf('roomGone')
      : problem === 'badDates'
        ? tf('badDates')
        : problem === 'tooMany'
          ? tf('tooMany')
          : problem === 'failed'
            ? tf('failed')
            : problem
  const blocked = sending || problem === 'roomGone' || problem === 'badDates' || wait > 0
  const unitOf = (s: Service) => (s.priceType === 'PER_NIGHT' ? t('units.perNight') : s.priceType === 'PER_PERSON' || s.perPerson ? t('units.perPerson') : `/${t('units.once')}`)

  if (bookedCode) {
    return (
      <Container className="pt-12">
        <div role="status" className="max-w-[640px] border border-line bg-panel p-6 lg:p-8">
          <h1 className="font-site text-[30px] leading-tight text-fg">{t('booking.done.title', { hotel: property.name })}</h1>
          <p className="mt-3 text-[15px] text-fg/80">{t('booking.done.waitingLead', { hotel: property.name })}</p>
          <p className="mt-5 text-label uppercase text-muted">{t('booking.done.code')}</p>
          <p className="mt-1 font-mono text-[28px] font-medium text-fg">{bookedCode}</p>
        </div>
      </Container>
    )
  }

  return (
    <Container className="pt-8 lg:pt-12">
      <SiteLink path={backPath} className="text-[14px] font-medium text-acc hover:underline">
        {tf('back')}
      </SiteLink>
      <h1 className="mt-3 font-site text-[34px] leading-[1.1] text-fg lg:text-[52px]">{tf('title')}</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-20">
        <details className="group border border-line bg-panel lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            {room.name}
            <span className="tabular-nums">{money(quote.total)}</span>
          </summary>
          <div className="border-t border-line">{summary}</div>
        </details>

        <form ref={formRef} onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-8 lg:gap-10">
          {problemText && (
            <p role="alert" className="border border-err/25 bg-err-soft px-4 py-3 text-[14px] leading-[1.55] text-fg">
              ⚠ {problemText}
              {problem === 'roomGone' && (
                <SiteLink path={backPath} className="ml-2 font-semibold underline">
                  {tf('backToRooms')}
                </SiteLink>
              )}
            </p>
          )}

          {section(
            '01',
            tf('guest'),
            <div className="flex flex-col gap-5">
              {field('bk-name', tf('name'), shown('name'), (
                <input id="bk-name" value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} autoComplete="name" disabled={sending} className={inputClass(!!shown('name'))} />
              ))}
              <div className="grid gap-5 sm:grid-cols-2">
                {field('bk-phone', tf('phone'), shown('phone'), (
                  <input id="bk-phone" type="tel" inputMode="tel" value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} autoComplete="tel" disabled={sending} className={inputClass(!!shown('phone'))} />
                ))}
                {field('bk-email', tf('email'), shown('email'), (
                  <input id="bk-email" type="email" inputMode="email" value={guest.email} onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))} autoComplete="email" disabled={sending} className={inputClass(!!shown('email'))} />
                ), tf('emailHint'))}
              </div>
              {field('bk-note', tf('note'), false, (
                <textarea
                  id="bk-note"
                  value={guest.note}
                  onChange={(e) => setGuest((g) => ({ ...g, note: e.target.value }))}
                  rows={3}
                  maxLength={1000}
                  disabled={sending}
                  placeholder={tf('notePlaceholder')}
                  className={cn(inputClass(), 'h-auto py-3 leading-[1.6]')}
                />
              ), undefined, tf('optional'))}
            </div>,
          )}

          {services.length > 0 &&
            section(
              '02',
              tf('services'),
              <ul className="border-t border-line">
                {services.map((s) => {
                  const n = qty[s.id] ?? 0
                  const set = (v: number) => setQty((q) => ({ ...q, [s.id]: Math.max(0, Math.min(20, v)) }))
                  return (
                    <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-line py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-6">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-fg">{s.name}</p>
                        {s.description && <p className="mt-0.5 text-[13px] text-muted">{s.description}</p>}
                      </div>
                      <p className="text-right">
                        <span className="block text-[15px] font-semibold tabular-nums">{money(s.price)}</span>
                        <span className="text-[12.5px] text-muted">{unitOf(s)}</span>
                      </p>
                      <div className="col-span-2 flex h-11 w-[140px] items-center justify-between border border-line bg-panel sm:col-span-1">
                        <button type="button" onClick={() => set(n - 1)} disabled={n === 0 || sending} aria-label={tf('fewer', { name: s.name })} className="h-full w-11 text-[18px] disabled:opacity-40">
                          −
                        </button>
                        <span className="text-[15px] font-medium tabular-nums">{n}</span>
                        <button type="button" onClick={() => set(n + 1)} disabled={sending} aria-label={tf('more', { name: s.name })} className="h-full w-11 text-[18px]">
                          +
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>,
              tf('servicesLead', { hotel: property.name }),
            )}

          {section(
            services.length > 0 ? '03' : '02',
            tf('invoice'),
            <div className="flex flex-col gap-5">
              <label className="flex cursor-pointer items-center gap-3 text-[15px] text-fg">
                <input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} disabled={sending} className="h-5 w-5 accent-ink" />
                <span>
                  {tf('invoiceAsk')} <span className="text-muted">{tf('optional')}</span>
                </span>
              </label>
              {invoice && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    {field('bk-company', tf('company'), shown('company'), (
                      <input id="bk-company" value={vat.company} onChange={(e) => setVat((v) => ({ ...v, company: e.target.value }))} autoComplete="organization" className={inputClass(!!shown('company'))} />
                    ))}
                  </div>
                  {field('bk-tax', tf('taxCode'), shown('taxCode'), (
                    <input id="bk-tax" inputMode="numeric" value={vat.taxCode} onChange={(e) => setVat((v) => ({ ...v, taxCode: e.target.value }))} placeholder={tf('taxCodeHint')} className={inputClass(!!shown('taxCode'))} />
                  ))}
                  {field('bk-vat-email', tf('invoiceEmail'), shown('vatEmail'), (
                    <input id="bk-vat-email" type="email" value={vat.email} onChange={(e) => setVat((v) => ({ ...v, email: e.target.value }))} className={inputClass(!!shown('vatEmail'))} />
                  ))}
                  <div className="sm:col-span-2">
                    {field('bk-vat-address', tf('companyAddress'), false, (
                      <input id="bk-vat-address" value={vat.address} onChange={(e) => setVat((v) => ({ ...v, address: e.target.value }))} autoComplete="street-address" className={inputClass()} />
                    ))}
                  </div>
                </div>
              )}
            </div>,
          )}

          {policies.length > 0 &&
            section(
              services.length > 0 ? '04' : '03',
              tf('policies'),
              <dl className="border-t border-line">
                {policies.map((p) => (
                  <div key={p.title} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
                    <dt className="text-[14.5px] font-medium text-fg">{p.title}</dt>
                    <dd className="text-[14.5px] leading-[1.6] text-fg/80">{p.text}</dd>
                  </div>
                ))}
              </dl>,
            )}

          {section(
            String(2 + (services.length > 0 ? 1 : 0) + (policies.length > 0 ? 1 : 0) + 1).padStart(2, '0'),
            tf('payment'),
            <div className="flex items-start justify-between gap-6 border border-ink bg-panel p-5 ring-1 ring-ink lg:p-6">
              <div className="flex gap-4">
                <span aria-hidden className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-ink">
                  <span className="h-2.5 w-2.5 rounded-full bg-ink" />
                </span>
                <div>
                  <p className="text-[16px] font-semibold text-fg">{deposit ? tf('depositTitle') : tf('hotelTitle')}</p>
                  <p className="mt-1.5 max-w-[500px] text-[14px] leading-[1.6] text-fg/80">
                    {deposit ? (
                      <>
                        {tf('depositText', { percent: deposit.percent })}
                        {deposit.deadlineMinutes > 0 && <> {tf('depositDeadline', { minutes: deposit.deadlineMinutes })}</>}
                      </>
                    ) : (
                      tf('hotelText')
                    )}
                  </p>
                </div>
              </div>
              <p className="flex-none text-right">
                <span className="block text-[12.5px] text-muted">{deposit ? tf('depositToday') : tf('payToday')}</span>
                <span className="text-[18px] font-semibold tabular-nums">{money(depositAmount)}</span>
              </p>
            </div>,
          )}

          {tried && errorCount > 0 && <p role="alert" className="bg-err-soft px-4 py-3 text-[14px] font-medium text-err">⚠ {tf('summary', { count: errorCount })}</p>}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <button type="submit" disabled={blocked} className="h-14 bg-ink px-9 text-[15px] font-medium text-on-ink transition-colors hover:bg-ink/90 disabled:bg-muted">
              {sending
                ? tf('sending')
                : wait > 0
                  ? tf('retryIn', { time: `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}` })
                  : deposit
                    ? tf('submitDeposit', { amount: money(depositAmount) })
                    : tf('submitHotel')}
            </button>
            <p className="max-w-[400px] text-[13px] leading-[1.55] text-muted">{tf('agree')}</p>
          </div>
        </form>

        <div className="hidden lg:block">
          <div className="sticky top-28">{summary}</div>
        </div>
      </div>
    </Container>
  )
}
