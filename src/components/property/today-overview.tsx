'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bed, BedDouble, Bell, CheckCircle, Clock, DoorOpen, ListChecks, PieChart, Receipt, Users, type LucideIcon } from 'lucide-react'
import { Button, PaymentStatusBadge } from '@/components/ui'
import { useCan } from '@/components/layout/workspace-context'
import {
  arrivalsOn,
  departuresOn,
  fetchBookingsAround,
  inHouse,
  monthArrivals,
  monthOccupancy,
  nightOccupancy,
  roomOn,
  type CalendarBooking,
} from '@/lib/bookings/calendar'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'

interface RoomType {
  id: string
  name: string
  totalRooms: number
}

interface Booking extends CalendarBooking {
  id: string
  bookingCode: string
  guestName: string
  paymentStatus: string
}

/** Rows of today's arrivals and departures shown before "+N more". */
const MOVES_SHOWN = 6

/**
 * "Today at the hotel", on top of the property's overview: the rooms and
 * this month's occupancy, who is in house, who arrives today, the month's
 * expected revenue (owner and managers only), the room types free tonight,
 * and today's arrivals and departures. These sat on the calendar page,
 * which is now a view of the bookings (bookings-views.tsx). Loads the
 * bookings around this month the way the calendar does (lib/bookings/calendar.ts).
 */
export function TodayOverview({ slug, propertyId }: { slug: string; propertyId: string }) {
  const t = useTranslations('dash.property.today')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const seesRevenue = useCan('revenue_view')
  const intlLocale = labels.locale === 'en' ? 'en-GB' : 'vi-VN'
  const headingId = React.useId()

  const [data, setData] = React.useState<{ roomTypes: RoomType[]; bookings: Booking[] } | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let active = true
    const now = new Date()
    setFailed(false)
    Promise.all([
      fetch(`/api/room-types?propertyId=${encodeURIComponent(propertyId)}`).then((res) => res.json()),
      // This month's nights and today's moves: every booking around the month.
      fetchBookingsAround<Booking>(propertyId, new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    ])
      .then(([types, bookings]) => {
        if (!active) return
        if (!types.success) throw new Error(types.error)
        setData({
          roomTypes: (types.data ?? []).map(({ id, name, totalRooms }: RoomType) => ({ id, name, totalRooms })),
          bookings,
        })
      })
      .catch((err) => {
        console.error('Today overview fetch error:', err)
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [propertyId, reloadKey])

  const figures = React.useMemo(() => {
    if (!data) return null
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const { roomTypes, bookings } = data
    const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)
    return {
      today,
      month: today.getMonth() + 1,
      roomTypes,
      totalRooms,
      occupancy: monthOccupancy(bookings, totalRooms, today.getFullYear(), today.getMonth()),
      house: inHouse(bookings),
      arrivals: arrivalsOn(bookings, today),
      departures: departuresOn(bookings, today),
      monthBookings: monthArrivals(bookings, today.getFullYear(), today.getMonth()),
      tonight: nightOccupancy(bookings, today),
      // Owner and managers (reports are theirs, nav.ts), and only when the API sent the amounts.
      showRevenue: seesRevenue && bookings.every((b) => typeof b.totalAmount === 'number'),
    }
  }, [data, seesRevenue])

  return (
    <section aria-labelledby={headingId} aria-busy={!figures && !failed} className="mb-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id={headingId} className="text-base font-semibold text-fg">
          {t('title')}
        </h2>
        <p className="text-small text-muted">{labels.longDate(new Date())}</p>
      </div>

      {failed ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-line bg-panel px-4 py-3">
          <p className="text-small text-muted">{t('loadError')}</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            {tc('actions.retry')}
          </Button>
        </div>
      ) : !figures ? (
        <div className="space-y-4" aria-hidden="true">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[92px] rounded-box border border-line bg-panel animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-40 rounded-box border border-line bg-panel animate-pulse motion-reduce:animate-none" />
            <div className="h-40 rounded-box border border-line bg-panel animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3.5', figures.showRevenue ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
            <StatCard
              label={t('stats.totalRooms')}
              value={<span className="text-fg">{figures.totalRooms}</span>}
              unit={<span className="text-[11px] text-muted font-medium">{t('stats.physicalRooms')}</span>}
              note={
                <span className="text-ok flex items-center gap-1">
                  <PieChart className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>
                    {t.rich('stats.monthOccupancy', {
                      percent: figures.occupancy.toLocaleString(intlLocale, { maximumFractionDigits: 1 }),
                      b: (c) => <strong className="text-acc">{c}</strong>,
                    })}
                  </span>
                </span>
              }
              icon={DoorOpen}
              tile="bg-info-soft text-info border-info/30"
            />
            <StatCard
              label={t('stats.inHouse')}
              value={<span className="text-ok">{figures.house.stays}</span>}
              unit={<span className="text-[11px] text-muted font-medium">{t('stats.ofRooms', { count: figures.totalRooms })}</span>}
              note={
                <span className="text-muted flex items-center gap-1">
                  <Users className="w-3 h-3 shrink-0 text-ok" aria-hidden="true" />
                  <span>{t('stats.guestsInHouse', { count: figures.house.guests })}</span>
                </span>
              }
              icon={Bed}
              tile="bg-ok-soft text-ok border-ok/30"
            />
            <StatCard
              label={t('stats.arrivingToday')}
              value={<span className="text-warn">{figures.arrivals.length}</span>}
              unit={
                <span className="text-[11px] text-warn bg-warn-soft px-1.5 rounded font-bold border border-warn/30">{t('stats.checkIns')}</span>
              }
              note={
                <span className="text-warn flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{t('stats.awaitingPayment', { count: figures.arrivals.filter((b) => b.status === 'PENDING').length })}</span>
                </span>
              }
              icon={Bell}
              tile="bg-warn-soft text-warn border-warn/30"
            />
            {figures.showRevenue && (
              <StatCard
                label={t('stats.expectedRevenue', { month: figures.month })}
                value={
                  <span className="text-fg">
                    {t('stats.millions', { amount: (figures.monthBookings.total / 1_000_000).toLocaleString(intlLocale, { maximumFractionDigits: 1 }) })}
                  </span>
                }
                note={
                  <span className="text-muted flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 shrink-0 text-acc" aria-hidden="true" />
                    <span>{t('stats.confirmed', { count: figures.monthBookings.count - figures.monthBookings.pending })}</span>
                  </span>
                }
                icon={Receipt}
                tile="bg-refund-soft text-refund border-refund/30"
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* The room types tonight: free rooms and how full. */}
            <div className="bg-panel rounded-box border border-line p-3.5">
              <PanelHeading icon={BedDouble} tile="bg-acc-soft text-acc" title={t('roomTypes.title')}>
                <span className="text-[11px] font-semibold text-muted">{t('roomTypes.summary', { count: figures.totalRooms })}</span>
              </PanelHeading>
              <div className="divide-y divide-line text-xs">
                {figures.roomTypes.length === 0 ? (
                  <p className="py-4 text-center text-muted text-xs">{t('roomTypes.empty')}</p>
                ) : (
                  figures.roomTypes.map((rt) => {
                    const occupied = Math.min(rt.totalRooms, figures.tonight.get(rt.id) ?? 0)
                    const empty = rt.totalRooms - occupied
                    const percent = rt.totalRooms > 0 ? Math.round((occupied / rt.totalRooms) * 100) : 0
                    return (
                      <div key={rt.id} className="py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="font-bold text-fg break-words">{rt.name}</h4>
                            <p className="text-[11px] text-muted">{t('roomTypes.rooms', { count: rt.totalRooms })}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={cn(
                                'inline-block px-1.5 py-0.5 rounded font-bold text-[11px] border',
                                empty === 0
                                  ? 'bg-err-soft text-err border-err/30'
                                  : empty <= 3
                                    ? 'bg-warn-soft text-warn border-warn/30'
                                    : 'bg-ok-soft text-ok border-ok/30'
                              )}
                            >
                              {t('roomTypes.free', { count: empty })}
                            </span>
                            <div className="text-[10px] text-muted mt-0.5">{t('roomTypes.full', { percent })}</div>
                          </div>
                        </div>
                        <div className="w-full bg-fg/5 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', percent >= 90 ? 'bg-err' : percent >= 70 ? 'bg-warn' : 'bg-ok')}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Today's arrivals and departures, each to its booking. */}
            <div className="bg-panel rounded-box border border-line p-3.5">
              <PanelHeading icon={ListChecks} tile="bg-info-soft text-info" title={t('moves.title')}>
                <Link
                  href={routes.propertyBookings(slug, propertyId)}
                  className="text-[11px] text-acc font-semibold hover:underline focus:outline-none focus-visible:underline"
                >
                  {t('moves.viewAll', { count: figures.arrivals.length + figures.departures.length })}
                </Link>
              </PanelHeading>
              <Moves slug={slug} propertyId={propertyId} today={figures.today} arrivals={figures.arrivals} departures={figures.departures} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({
  label,
  value,
  unit,
  note,
  icon: Icon,
  tile,
}: {
  label: string
  value: React.ReactNode
  unit?: React.ReactNode
  note: React.ReactNode
  icon: LucideIcon
  tile: string
}) {
  return (
    <div className="bg-panel rounded-box border border-line p-3.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">{label}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5">
          <span className="text-2xl font-black tabular-nums">{value}</span>
          {unit}
        </div>
        <div className="text-[11px] font-medium mt-0.5">{note}</div>
      </div>
      <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center shrink-0', tile)}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
    </div>
  )
}

function PanelHeading({ icon: Icon, tile, title, children }: { icon: LucideIcon; tile: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-line">
      <div className="flex items-center gap-2">
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', tile)}>
          <Icon className="w-3 h-3" aria-hidden="true" />
        </div>
        <h3 className="font-bold text-xs text-fg">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Moves({
  slug,
  propertyId,
  today,
  arrivals,
  departures,
}: {
  slug: string
  propertyId: string
  today: Date
  arrivals: Booking[]
  departures: Booking[]
}) {
  const t = useTranslations('dash.property.today.moves')
  const rows = [...arrivals.map((b) => ({ b, out: false })), ...departures.map((b) => ({ b, out: true }))]
  if (rows.length === 0) return <p className="text-center py-4 text-muted text-xs">{t('none')}</p>
  return (
    <>
      <ul className="space-y-2 mt-2.5">
        {rows.slice(0, MOVES_SHOWN).map(({ b, out }) => (
          <li key={`${out ? 'out' : 'in'}-${b.id}`}>
            <Link
              href={routes.propertyBooking(slug, propertyId, b.id)}
              className="block p-2.5 rounded-lg border border-line bg-page/60 hover:bg-panel hover:border-acc/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              {/* The badge drops under the name when the card is narrow (phones): it is nowrap. */}
              <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                <span className="min-w-0 flex-[1_1_8rem]">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-fg text-xs break-words">{b.guestName}</span>
                    <span
                      className={cn(
                        'text-[9px] border px-1 rounded font-bold',
                        out ? 'bg-warn-soft text-warn border-warn/30' : 'bg-ok-soft text-ok border-ok/30'
                      )}
                    >
                      {out ? t('checkOut') : t('checkIn')}
                    </span>
                  </span>
                  <span className="block text-[11px] text-muted mt-0.5">
                    {t('roomLine', { room: roomOn(b, today) || '---', code: b.bookingCode })}
                  </span>
                </span>
                <PaymentStatusBadge status={b.paymentStatus} className="shrink-0" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > MOVES_SHOWN && <p className="mt-2 text-[11px] text-muted text-center">{t('more', { count: rows.length - MOVES_SHOWN })}</p>}
    </>
  )
}
