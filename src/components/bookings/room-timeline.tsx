'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { useDashLabels } from '@/lib/i18n/dash'

interface TimelineRoom {
  id: string
  number: string
  floor: number | null
  isActive: boolean
}

interface TimelineType {
  id: string
  name: string
  totalRooms: number
  isActive: boolean
  rooms: TimelineRoom[]
}

interface Stay {
  bookingId: string
  bookingCode: string
  guestName: string
  status: string
  paymentStatus: string
  checkIn: string
  checkOut: string
  /** the nights of this bar: the stay, or its part in this room when it changes rooms */
  from: string
  to: string
  split: boolean
  guests: number
  roomTypeId: string
  roomId: string | null
  roomNumber: string | null
}

interface Lock {
  id: string
  roomTypeId: string
  roomId: string | null
  start: string
  end: string
  type: string
  note: string | null
}

interface Timeline {
  from: string
  days: number
  roomTypes: TimelineType[]
  stays: Stay[]
  locks: Lock[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const VN_MS = 7 * 60 * 60 * 1000
const COL = 44
const LABEL = 132
const ROW = 40

/** yyyy-mm-dd of an instant in Vietnam time. */
const vnDay = (iso: string | Date) => new Date(new Date(iso).getTime() + VN_MS).toISOString().slice(0, 10)
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const between = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

/** Night columns a span covers in the window [0, days): from its first night to the night before it ends. */
function columns(from: string, days: number, start: string, end: string) {
  const a = Math.max(0, between(from, vnDay(start)))
  const b = Math.min(days, between(from, vnDay(end)))
  return b > a ? { start: a, span: b - a } : null
}

/** Stays packed into lanes that never overlap (for the "not in a room yet" rows). */
function lanes(stays: Stay[]) {
  const sorted = [...stays].sort((x, y) => Date.parse(x.from) - Date.parse(y.from))
  const out: Stay[][] = []
  for (const stay of sorted) {
    const lane = out.find((l) => Date.parse(l[l.length - 1].to) <= Date.parse(stay.from))
    if (lane) lane.push(stay)
    else out.push([stay])
  }
  return out
}

/**
 * The nights a drag moves (POST /api/bookings/[id]/room): a whole stay as
 * before; but a guest in house, or one part of a stay that changes rooms,
 * moves from tonight at the earliest — nights already slept stay where they
 * were (rooms.ts). null: nothing left to move.
 */
function nightsMoved(stay: Stay, today: string): { fromDate?: string; toDate?: string } | null {
  if (!stay.split && stay.status !== 'CHECKED_IN') return {}
  const from = vnDay(stay.from) < today ? today : vnDay(stay.from)
  const to = vnDay(stay.to)
  if (from >= to) return null
  if (from === vnDay(stay.checkIn) && to === vnDay(stay.checkOut)) return {}
  return { fromDate: from, ...(to !== vnDay(stay.checkOut) && { toDate: to }) }
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-warn-soft border-warn/40 text-fg',
  CONFIRMED: 'bg-info-soft border-info/40 text-fg',
  CHECKED_IN: 'bg-ok-soft border-ok/40 text-fg',
  CHECKED_OUT: 'bg-plain-soft border-line text-muted',
}

/**
 * The room timeline (task 25): rooms down, Vietnam days across, every stay a
 * bar in its room; stays not in a room yet sit under their type. Click an
 * empty night to book it (walk-in), a bar to open the booking; drag a bar to
 * another room to move the guest (POST /api/bookings/[id]/room checks the
 * room is free, src/lib/bookings/rooms.ts). A stay that changes rooms part
 * way draws one bar per room, each dragged on its own (nightsMoved).
 * Maintenance shows hatched.
 */
export function RoomTimeline({
  propertyId,
  onOpenBooking,
  onCreate,
  refreshKey,
}: {
  propertyId: string
  onOpenBooking: (bookingId: string) => void
  onCreate: (input: { roomTypeId: string; room?: { id: string; number: string }; date: string }) => void
  /** bump to reload (after a booking changed elsewhere on the page) */
  refreshKey: number
}) {
  const t = useTranslations('dash.calendar.timeline')
  const labels = useDashLabels()
  const [from, setFrom] = React.useState(() => addDays(vnDay(new Date()), -1))
  const [days, setDays] = React.useState(14)
  const [data, setData] = React.useState<Timeline | null>(null)
  const [error, setError] = React.useState('')
  const [dragging, setDragging] = React.useState<Stay | null>(null)
  const [dropRow, setDropRow] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setError('')
    const res = await fetch(`/api/properties/${propertyId}/timeline?from=${from}&days=${days}`, { cache: 'no-store' }).catch(() => null)
    const body = res ? await res.json().catch(() => null) : null
    if (body?.success) setData(body.data)
    else setError(apiError(body?.error) || t('loadError'))
  }, [propertyId, from, days, t])

  React.useEffect(() => {
    load()
  }, [load, refreshKey])

  const today = vnDay(new Date())
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i))
  const weekday = (day: string) =>
    new Intl.DateTimeFormat(labels.locale === 'en' ? 'en-GB' : 'vi-VN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

  const move = async (stay: Stay, room: { id: string; number: string } | null) => {
    setDragging(null)
    setDropRow(null)
    const nights = nightsMoved(stay, today)
    if (!nights || room?.id === stay.roomId || (!room && !stay.roomId)) return
    const label = (day: string) => labels.dayMonth(`${day}T00:00:00+07:00`)
    const what = { code: stay.bookingCode, room: room?.number ?? '' }
    const ok = confirm(
      !room
        ? t('confirmUnassign', { code: stay.bookingCode })
        : nights.toDate
          ? t('confirmMoveNights', { ...what, from: label(nights.fromDate!), to: label(nights.toDate) })
          : nights.fromDate
            ? t('confirmMoveFrom', { ...what, date: label(nights.fromDate) })
            : t('confirmMove', what)
    )
    if (!ok) return
    const res = await fetch(`/api/bookings/${stay.bookingId}/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: room?.id ?? null, ...nights }),
    }).catch(() => null)
    const body = res ? await res.json().catch(() => null) : null
    if (body?.success) {
      toast.success(
        !room
          ? t('unassigned', { code: stay.bookingCode })
          : nights.toDate
            ? t('movedNights', { ...what, from: label(nights.fromDate!), to: label(nights.toDate) })
            : nights.fromDate
              ? t('movedFrom', { ...what, date: label(nights.fromDate) })
              : t('moved', what)
      )
      load()
    } else {
      toast.error(t('moveFailed'), apiError(body?.error))
    }
  }

  const bar = (stay: Stay) => {
    const col = columns(from, days, stay.from, stay.to)
    if (!col) return null
    const movable = stay.status !== 'CHECKED_OUT' && nightsMoved(stay, today) !== null
    const part = stay.split ? ` · ${t('part', { room: stay.roomNumber ?? '', from: labels.dayMonth(stay.from), to: labels.dayMonth(stay.to) })}` : ''
    return (
      <button
        key={`${stay.bookingId}:${stay.from}`}
        type="button"
        draggable={movable}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', stay.bookingId)
          setDragging(stay)
        }}
        onDragEnd={() => {
          setDragging(null)
          setDropRow(null)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onOpenBooking(stay.bookingId)
        }}
        title={`${stay.bookingCode} · ${stay.guestName} · ${labels.dayMonth(stay.checkIn)} → ${labels.dayMonth(stay.checkOut)}${part} · ${labels.bookingStatus(stay.status)}`}
        className={cn(
          'absolute top-1 bottom-1 z-[1] flex items-center gap-1 overflow-hidden rounded-[6px] border px-1.5 text-left text-[11px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
          STATUS_STYLE[stay.status] ?? STATUS_STYLE.CONFIRMED,
          movable && 'cursor-grab active:cursor-grabbing'
        )}
        style={{ left: col.start * COL + 2, width: col.span * COL - 4 }}
      >
        {stay.split && <ArrowRightLeft className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />}
        <span className="truncate font-medium">{stay.guestName}</span>
        {col.span > 1 && <span className="shrink-0 font-mono text-[10px] text-muted">{stay.bookingCode.slice(-4)}</span>}
      </button>
    )
  }

  const block = (lock: Lock) => {
    const col = columns(from, days, lock.start, lock.end)
    if (!col) return null
    return (
      <div
        key={lock.id}
        title={`${t('maintenance')}${lock.note ? ` · ${lock.note}` : ''}`}
        className="absolute top-1 bottom-1 rounded-[6px] border border-warn/40 text-[10px] text-warn flex items-center px-1.5 overflow-hidden"
        style={{
          left: col.start * COL + 2,
          width: col.span * COL - 4,
          backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, currentColor 18%, transparent) 6px 8px)',
        }}
      >
        <span className="truncate">{t('maintenance')}</span>
      </div>
    )
  }

  /** One row: the label, the night cells (click to book), and what lies on it. */
  const row = (key: string, label: React.ReactNode, content: React.ReactNode, opts: { roomTypeId: string; room?: TimelineRoom; inactive?: boolean; dropTo?: { id: string; number: string } | null }) => {
    // A room of any type; "not in a room" only for the stay's own type, and a whole stay.
    const droppable =
      !!dragging &&
      opts.dropTo !== undefined &&
      (opts.dropTo !== null || (dragging.roomTypeId === opts.roomTypeId && !nightsMoved(dragging, today)?.fromDate))
    return (
      <div key={key} className="flex border-b border-line last:border-b-0">
        <div className="sticky left-0 z-[2] flex shrink-0 items-center gap-1.5 border-r border-line bg-panel px-3 text-xs" style={{ width: LABEL, height: ROW }}>
          {label}
        </div>
        <div
          className={cn('relative', droppable && dropRow === key && 'bg-acc-soft')}
          style={{ width: days * COL, height: ROW }}
          onDragOver={(e) => {
            if (!droppable) return
            e.preventDefault()
            setDropRow(key)
          }}
          onDragLeave={() => setDropRow((r) => (r === key ? null : r))}
          onDrop={(e) => {
            e.preventDefault()
            if (droppable && dragging && opts.dropTo !== undefined) move(dragging, opts.dropTo)
          }}
        >
          <div className="absolute inset-0 flex">
            {dayList.map((day) => (
              <button
                key={day}
                type="button"
                tabIndex={-1}
                aria-label={t('bookNight', { date: labels.dayMonth(`${day}T00:00:00+07:00`), room: opts.room?.number ?? '' })}
                disabled={opts.inactive}
                onClick={() => onCreate({ roomTypeId: opts.roomTypeId, room: opts.room && { id: opts.room.id, number: opts.room.number }, date: day })}
                className={cn(
                  'h-full shrink-0 border-r border-line/60 hover:bg-fg/[0.04] disabled:cursor-default disabled:hover:bg-transparent',
                  day === today && 'bg-acc-soft/40',
                  [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()) && 'bg-fg/[0.02]'
                )}
                style={{ width: COL }}
              />
            ))}
          </div>
          {content}
        </div>
      </div>
    )
  }

  return (
    <section className="bg-panel rounded-xl border border-line overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFrom(addDays(from, -7))} aria-label={t('previous')} className="w-8 h-8 rounded-ctl border border-line flex items-center justify-center hover:bg-fg/5">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setFrom(addDays(vnDay(new Date()), -1))} className="h-8 px-3 rounded-ctl border border-line text-xs font-semibold hover:bg-fg/5">
            {t('today')}
          </button>
          <button type="button" onClick={() => setFrom(addDays(from, 7))} aria-label={t('next')} className="w-8 h-8 rounded-ctl border border-line flex items-center justify-center hover:bg-fg/5">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="ml-1 text-sm font-semibold text-fg">
            {labels.dayMonth(`${from}T00:00:00+07:00`)} – {labels.dayMonth(`${addDays(from, days - 1)}T00:00:00+07:00`)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ul className="hidden md:flex items-center gap-3 text-[11px] text-muted">
            {(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const).map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <span className={cn('inline-block w-3 h-3 rounded-[3px] border', STATUS_STYLE[status])} aria-hidden="true" />
                {labels.bookingStatus(status)}
              </li>
            ))}
          </ul>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label={t('range')}
            className="h-8 rounded-ctl border border-line bg-raised px-2 text-xs text-fg"
          >
            {[7, 14, 30].map((n) => (
              <option key={n} value={n}>
                {t('days', { count: n })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="px-4 py-3 text-sm text-err">{error}</p>}
      {!data ? (
        !error && <p className="px-4 py-16 text-center text-sm text-muted">{t('loading')}</p>
      ) : data.roomTypes.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted">{t('noTypes')}</p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ width: LABEL + days * COL }}>
            {/* Days */}
            <div className="flex border-b border-line bg-fg/[0.03] sticky top-0 z-[3]">
              <div className="sticky left-0 z-[4] shrink-0 border-r border-line bg-panel px-3 py-2 text-[11px] font-semibold text-muted" style={{ width: LABEL }}>
                {t('room')}
              </div>
              {dayList.map((day) => (
                <div
                  key={day}
                  className={cn('shrink-0 border-r border-line/60 py-1.5 text-center leading-tight', day === today ? 'text-acc font-bold' : 'text-muted')}
                  style={{ width: COL }}
                >
                  <div className="text-[10px] uppercase">{weekday(day)}</div>
                  <div className="text-[11px] font-semibold tabular-nums">{day.slice(8)}/{day.slice(5, 7)}</div>
                </div>
              ))}
            </div>

            {data.roomTypes.map((type) => {
              const stays = data.stays.filter((s) => s.roomTypeId === type.id)
              const byNumber = new Map(type.rooms.map((r) => [r.number.toLowerCase(), r]))
              const roomOf = (s: Stay) =>
                (s.roomId && type.rooms.find((r) => r.id === s.roomId)) || (s.roomNumber ? byNumber.get(s.roomNumber.toLowerCase()) : undefined)
              const unplaced = stays.filter((s) => !roomOf(s))
              const typeLocks = data.locks.filter((l) => l.roomTypeId === type.id && !l.roomId)
              // Rooms left each night: the type's count less its stays and closures.
              const left = dayList.map((day) => {
                const night = (start: string, end: string) => vnDay(start) <= day && day < vnDay(end)
                const taken =
                  stays.filter((s) => s.status !== 'CHECKED_OUT' && night(s.from, s.to)).length +
                  data.locks.filter((l) => l.roomTypeId === type.id && night(l.start, l.end)).length
                return type.totalRooms - taken
              })
              const unplacedLanes = lanes(unplaced)
              return (
                <div key={type.id} className="border-b-2 border-line">
                  <div className="flex bg-fg/[0.02] border-b border-line">
                    <div className="sticky left-0 z-[2] shrink-0 border-r border-line bg-panel px-3 py-1.5 text-xs font-semibold text-fg truncate" style={{ width: LABEL }} title={type.name}>
                      {type.name}
                    </div>
                    {left.map((n, i) => (
                      <div
                        key={dayList[i]}
                        className={cn('shrink-0 border-r border-line/60 py-1.5 text-center text-[10px] tabular-nums', n <= 0 ? 'text-err font-semibold' : 'text-muted')}
                        style={{ width: COL }}
                        title={t('left', { count: Math.max(0, n) })}
                      >
                        {n <= 0 ? t('full') : n}
                      </div>
                    ))}
                  </div>
                  {type.rooms.map((room) =>
                    row(
                      room.id,
                      <>
                        <span className={cn('font-semibold tabular-nums', !room.isActive && 'text-muted line-through')}>{room.number}</span>
                        {room.floor !== null && <span className="text-[10px] text-muted">{t('floor', { floor: room.floor })}</span>}
                      </>,
                      <>
                        {data.locks.filter((l) => l.roomId === room.id).map(block)}
                        {stays.filter((s) => roomOf(s)?.id === room.id).map(bar)}
                      </>,
                      { roomTypeId: type.id, room, inactive: !room.isActive, dropTo: room.isActive ? { id: room.id, number: room.number } : undefined }
                    )
                  )}
                  {(unplacedLanes.length > 0 || type.rooms.length === 0) &&
                    (unplacedLanes.length ? unplacedLanes : [[]]).map((lane, i) =>
                      row(
                        `${type.id}:unplaced:${i}`,
                        <span className="text-muted">{type.rooms.length ? t('unplaced') : t('noRooms')}</span>,
                        <>{lane.map(bar)}</>,
                        // Out of a room: drop here (only for this type's listed rooms).
                        { roomTypeId: type.id, dropTo: type.rooms.length ? null : undefined }
                      )
                    )}
                  {typeLocks.length > 0 &&
                    row(`${type.id}:locks`, <span className="text-muted">{t('maintenanceAny')}</span>, <>{typeLocks.map(block)}</>, { roomTypeId: type.id })}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {data && <p className="border-t border-line px-4 py-2.5 text-[11px] text-muted">{t('hint')}</p>}
    </section>
  )
}
