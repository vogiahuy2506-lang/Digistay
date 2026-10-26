'use client'

import * as React from 'react'
import { Check, Copy, MoreHorizontal, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PaymentStatusBadge,
  Select,
  Textarea,
  toast,
} from '@/components/ui'
import { canManageBookings, useWorkspaceRole } from '@/components/layout/workspace-context'
import { CheckOutDialog } from './check-out-dialog'
import { CancelDialog } from './cancel-dialog'
import { CheckInDialog } from './check-in-dialog'
import { buildPrintHtml, nightsBetween, remainingAmount } from '@/lib/bookings/display'
import { addDays as addDay, nightStart, roomPlan, spanOnNight, vnDay } from '@/lib/bookings/room-plan'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'

/**
 * A booking's details and actions, shared by the side panel on the bookings
 * list (redesign 4b/4d) and the booking's own page.
 */

export interface BookingDetailData {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestNote: string | null
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  status: string
  subtotal: number
  extraCharges: number
  discount: number
  totalAmount: number
  depositAmount: number
  paymentStatus: string
  actualCheckIn: string | null
  actualCheckOut: string | null
  vatCompany: string | null
  vatTaxCode: string | null
  vatAddress: string | null
  vatEmail: string | null
  source: string
  createdAt: string
  bookingItems: { id: string; roomTypeId: string; roomTypeName: string | null; roomNumber: string | null; roomId?: string | null }[]
  /** A stay split between rooms, in night order (src/lib/bookings/room-plan.ts); none for one room. */
  roomSegments?: { roomId: string | null; roomNumber: string; roomTypeId: string; roomTypeName: string | null; fromDate: string; toDate: string }[]
  property: {
    id: string
    name: string
    address?: string | null
    phone?: string | null
    policy?: { checkInTime: string | null; checkOutTime: string | null } | null
  }
  payments: { id: string; amount: number; method: string; status: string; paidAt: string | null; createdAt: string }[]
}

/** Loads one booking; `reload` refetches after an action. */
export function useBooking(bookingId: string | null) {
  const t = useTranslations('dash.bookings')
  const [booking, setBooking] = React.useState<BookingDetailData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!bookingId) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/bookings/${bookingId}`, { signal })
        const data = await res.json()
        if (signal?.aborted) return
        if (data.success) setBooking(data.data)
        else setError(apiError(data.error) || t('detail.loadError'))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError(t('detail.loadError'))
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [bookingId, t]
  )

  React.useEffect(() => {
    setBooking(null)
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { booking, loading, error, reload: () => load() }
}

/** dd/mm of a Vietnam day. */
const dayMonth = (value: string) => vnDay(value).slice(5).split('-').reverse().join('/')

/** The room line on the printed slip, which stays in Vietnamese (buildPrintHtml). */
export function roomLabel(booking: Pick<BookingDetailData, 'bookingItems' | 'roomSegments'>): string {
  const item = booking.bookingItems[0]
  if (!item) return 'Chưa có phòng'
  // A split stay: every room with its nights.
  const parts = booking.roomSegments ?? []
  if (parts.length > 1) {
    return parts.map((p) => `${p.roomTypeName ?? 'Hạng phòng đã xoá'} · ${p.roomNumber} (${dayMonth(p.fromDate)} – ${dayMonth(p.toDate)})`).join(', ')
  }
  const name = item.roomTypeName ?? 'Hạng phòng đã xoá'
  const more = booking.bookingItems.length > 1 ? ` (+${booking.bookingItems.length - 1} phòng)` : ''
  return `${name}${item.roomNumber ? ` · ${item.roomNumber}` : ''}${more}`
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-5 first:pt-0 border-b border-line last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-label uppercase text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1 text-small">
      <dt className="text-muted">{label}</dt>
      <dd className="text-fg min-w-0 break-words">{children}</dd>
    </div>
  )
}

function MoneyRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'warn' }) {
  return (
    <div className={cn('flex justify-between gap-3 py-1 text-small tabular-nums', strong && 'font-semibold text-body')}>
      <span className={strong ? 'text-fg' : 'text-muted'}>{label}</span>
      <span className={cn('text-fg whitespace-nowrap', tone === 'warn' && 'text-warn')}>{value}</span>
    </div>
  )
}

export function BookingDetailContent({ booking, onChanged }: { booking: BookingDetailData; onChanged: () => void }) {
  const role = useWorkspaceRole()
  const t = useTranslations('dash.bookings.detail')
  const tb = useTranslations('dash.bookings')
  const labels = useDashLabels()
  const nights = nightsBetween(booking.checkInDate, booking.checkOutDate)
  const remaining = remainingAmount(booking)
  const checkInTime = booking.property.policy?.checkInTime || '14:00'
  const checkOutTime = booking.property.policy?.checkOutTime || '12:00'
  const editable = canManageBookings(role)
  const parts = booking.roomSegments ?? []
  const typeNames = parts.length > 1 ? [...new Set(parts.map((p) => p.roomTypeName ?? tb('room.deletedType')))].join(' → ') : null
  // "From the night of D": nights strictly inside the stay, from tonight on (Vietnam), in a listed room.
  const [movingFrom, setMovingFrom] = React.useState(false)
  const moveDays = movableNights(booking)
  const canMoveFrom = editable && moveDays.length > 0 && (parts.length > 1 || !!booking.bookingItems[0]?.roomId)

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(booking.guestPhone)
      toast.success(t('guest.copied'))
    } catch {
      toast.error(t('guest.copyFailed'), booking.guestPhone)
    }
  }

  return (
    <div>
      <Section title={t('guest.title')}>
        <p className="text-body font-medium text-fg">{booking.guestName}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-small text-fg tabular-nums">{booking.guestPhone}</span>
          <span className="flex gap-1.5">
            <a
              href={`tel:${booking.guestPhone.replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-ctl border border-line text-small text-fg hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              {t('guest.call')}
            </a>
            <Button variant="outline" size="sm" onClick={copyPhone}>
              <Copy className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              {t('guest.copy')}
            </Button>
          </span>
        </div>
        <dl className="mt-2">
          <Field label={t('email')}>
            {booking.guestEmail ? (
              <a href={`mailto:${booking.guestEmail}`} className="hover:underline">
                {booking.guestEmail}
              </a>
            ) : (
              <span className="text-muted">—</span>
            )}
          </Field>
          <Field label={t('guest.guests')}>{labels.guests(booking.numAdults, booking.numChildren)}</Field>
        </dl>
        {booking.guestNote && (
          <p className="mt-2 rounded-ctl bg-fg/5 px-3 py-2 text-small text-fg">
            <span className="text-muted">{t('guest.note')} </span>
            {booking.guestNote}
          </p>
        )}
      </Section>

      <Section title={t('stay.title')}>
        <dl>
          <Field label={t('stay.roomType')}>
            {booking.bookingItems.length === 0
              ? tb('room.none')
              : typeNames ?? booking.bookingItems[0].roomTypeName ?? tb('room.deletedType')}
          </Field>
          <Field label={t('stay.roomNumber')}>
            <RoomNumber booking={booking} onChanged={onChanged} editable={editable} onMoveFrom={canMoveFrom && !movingFrom ? () => setMovingFrom(true) : undefined} />
          </Field>
          <Field label={t('stay.checkIn')}>
            {labels.longDate(booking.checkInDate)} · {checkInTime}
            {booking.actualCheckIn && (
              <span className="block text-ok">{t('stay.checkedInAt', { time: labels.dateTime(booking.actualCheckIn) })}</span>
            )}
          </Field>
          <Field label={t('stay.checkOut')}>
            {labels.longDate(booking.checkOutDate)} · {checkOutTime}
            {booking.actualCheckOut && (
              <span className="block text-muted">{t('stay.checkedOutAt', { time: labels.dateTime(booking.actualCheckOut) })}</span>
            )}
          </Field>
          <Field label={t('stay.nights')}>{labels.nights(nights)}</Field>
        </dl>
        {movingFrom && (
          <MoveFrom
            booking={booking}
            days={moveDays}
            onClose={() => setMovingFrom(false)}
            onDone={() => {
              setMovingFrom(false)
              onChanged()
            }}
          />
        )}
      </Section>

      <Section title={t('money.title')}>
        <MoneyRow label={t('money.room')} value={labels.money(booking.subtotal)} />
        {booking.extraCharges > 0 && <MoneyRow label={t('money.extraCharges')} value={labels.money(booking.extraCharges)} />}
        {booking.discount > 0 && <MoneyRow label={t('money.discount')} value={`−${labels.money(booking.discount)}`} />}
        <div className="my-2 border-t border-line" />
        <MoneyRow label={t('money.total')} value={labels.money(booking.totalAmount)} strong />
        <MoneyRow label={t('money.paid')} value={labels.money(booking.depositAmount)} />
        <MoneyRow
          label={t('money.remaining')}
          value={labels.money(remaining)}
          strong
          tone={remaining > 0 && booking.status !== 'CANCELLED' ? 'warn' : undefined}
        />

        <h4 className="mt-4 mb-2 text-small font-medium text-fg">{t('money.payments')}</h4>
        {booking.payments.length === 0 ? (
          <p className="text-small text-muted">{t('money.noPayments')}</p>
        ) : (
          <ul className="space-y-2">
            {booking.payments.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 rounded-ctl border border-line px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-small text-fg">{labels.paymentMethod(p.method)}</span>
                  <span className="block text-xs text-muted">{labels.dateTime(p.paidAt ?? p.createdAt)}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-small font-medium tabular-nums whitespace-nowrap">{labels.money(p.amount)}</span>
                  <PaymentStatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {booking.vatCompany && (
        <Section title={t('vat.title')}>
          <dl>
            <Field label={t('vat.company')}>{booking.vatCompany}</Field>
            {booking.vatTaxCode && <Field label={t('vat.taxCode')}>{booking.vatTaxCode}</Field>}
            {booking.vatAddress && <Field label={t('vat.address')}>{booking.vatAddress}</Field>}
            {booking.vatEmail && <Field label={t('email')}>{booking.vatEmail}</Field>}
          </dl>
        </Section>
      )}
    </div>
  )
}

interface RoomChoice {
  id: string
  number: string
  roomTypeId: string
  roomTypeName: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE'
  bookingCode: string | null
}

/**
 * The stay's room. Once the hotel lists its rooms (src/lib/bookings/rooms.ts)
 * a choice of them, free ones first and other types too (moving the stay
 * there when that type has a room free), through POST /api/bookings/[id]/room;
 * otherwise a typed number, checked against every other stay.
 */
function RoomNumber({
  booking,
  onChanged,
  editable,
  onMoveFrom,
}: {
  booking: BookingDetailData
  onChanged: () => void
  editable: boolean
  /** opens "Đổi phòng từ ngày…" (MoveFrom), when the stay has a night left to move */
  onMoveFrom?: () => void
}) {
  const t = useTranslations('dash.bookings.detail.roomNumber')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const current = booking.bookingItems[0]?.roomNumber ?? ''
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(current)
  const [saving, setSaving] = React.useState(false)
  // null: not loaded; [] with listed false: the hotel lists no rooms (typed number).
  const [choices, setChoices] = React.useState<{ listed: boolean; rooms: RoomChoice[] } | null>(null)

  React.useEffect(() => setValue(current), [current])

  const open = async () => {
    setEditing(true)
    setChoices(null)
    const item = booking.bookingItems[0]
    if (!item) return setChoices({ listed: false, rooms: [] })
    const query = new URLSearchParams({
      propertyId: booking.property.id,
      roomTypeId: item.roomTypeId,
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate,
      all: '1',
      allTypes: '1',
      excludeBookingId: booking.id,
    })
    const res = await fetch(`/api/rooms/available?${query}`).catch(() => null)
    const data = res?.ok ? await res.json().catch(() => null) : null
    const rooms: RoomChoice[] = data?.success && data.meta?.listed ? data.data : []
    setChoices({ listed: rooms.length > 0, rooms })
    const mine = rooms.find((r) => r.number === current)
    setValue(mine ? mine.id : rooms.length ? '' : current)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = choices?.listed
        ? await fetch(`/api/bookings/${booking.id}/room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: value === '__none' ? null : value }),
          })
        : await fetch(`/api/bookings/${booking.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomNumber: value.trim() }),
          })
      const data = await res.json()
      if (data.success) {
        toast.success(data.data?.roomTypeChanged ? t('movedType') : t('assigned'))
        setEditing(false)
        onChanged()
      } else {
        toast.error(t('assignFailed'), apiError(data.error))
      }
    } catch {
      toast.error(t('assignFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    const parts = booking.roomSegments ?? []
    const tonight = spanOnNight(roomPlan(booking), vnDay(new Date()))
    const link = 'text-small text-acc hover:underline focus:outline-none focus-visible:underline'
    return (
      <span className="flex flex-col items-start gap-1">
        {parts.length > 1 ? (
          // A split stay: each room with its nights, tonight's marked.
          <ul className="space-y-0.5" aria-label={t('plan')}>
            {parts.map((p) => (
              <li key={p.fromDate} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium tabular-nums">{p.roomNumber}</span>
                <span className="text-small text-muted tabular-nums">
                  {labels.dayMonth(p.fromDate)} → {labels.dayMonth(p.toDate)}
                </span>
                {tonight && tonight.from.getTime() === new Date(p.fromDate).getTime() && <span className="text-xs font-medium text-ok">{t('tonight')}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <span>{current || <span className="text-muted">{t('unassigned')}</span>}</span>
        )}
        {editable && (
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <button type="button" onClick={open} className={link}>
              {current ? (parts.length > 1 ? t('changeWhole') : t('change')) : t('assign')}
            </button>
            {onMoveFrom && (
              <button type="button" onClick={onMoveFrom} className={link}>
                {t('moveFrom')}
              </button>
            )}
          </span>
        )}
      </span>
    )
  }

  if (!choices) return <span className="text-small text-muted">{t('loading')}</span>

  const typeId = booking.bookingItems[0]?.roomTypeId
  const reason = (r: RoomChoice) =>
    r.status === 'OCCUPIED' ? t('statusOccupied', { code: r.bookingCode ?? '' }) : r.status === 'MAINTENANCE' ? t('statusMaintenance') : t('statusInactive')
  const groups = choices.listed
    ? [...new Set(choices.rooms.map((r) => r.roomTypeId))]
        .sort((a, b) => (a === typeId ? -1 : b === typeId ? 1 : 0))
        .map((id) => ({ id, name: choices.rooms.find((r) => r.roomTypeId === id)!.roomTypeName, rooms: choices.rooms.filter((r) => r.roomTypeId === id) }))
    : []

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) save()
      }}
    >
      {choices.listed ? (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t('label')}
          className="h-9 sm:h-8 max-w-[260px] rounded-ctl border border-line bg-raised px-2 text-small text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
          autoFocus
        >
          <option value="" disabled>
            {t('choose')}
          </option>
          {current && <option value="__none">{t('unassign')}</option>}
          {groups.map((group) => (
            <optgroup key={group.id} label={group.id === typeId ? group.name : t('otherType', { type: group.name })}>
              {group.rooms.map((r) => (
                <option key={r.id} value={r.id} disabled={r.status !== 'AVAILABLE' && r.number !== current}>
                  {r.number}
                  {r.status !== 'AVAILABLE' && r.number !== current ? ` · ${reason(r)}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('placeholder')} aria-label={t('label')} className="h-9 sm:h-8 w-28" autoFocus />
      )}
      <Button type="submit" size="sm" isLoading={saving} disabled={!value.trim()} aria-label={t('save')}>
        <Check className="w-3.5 h-3.5" aria-hidden="true" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => { setValue(current); setEditing(false) }}>
        {tc('actions.cancel')}
      </Button>
    </form>
  )
}

/**
 * The nights a stay can still change rooms from (rooms.ts): strictly inside
 * it (after the check-in day, before the check-out day) and not before
 * today in Vietnam; an active stay only.
 */
function movableNights(booking: Pick<BookingDetailData, 'status' | 'checkInDate' | 'checkOutDate'>): string[] {
  if (!['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)) return []
  const today = vnDay(new Date())
  const last = vnDay(booking.checkOutDate)
  const days: string[] = []
  for (let d = addDay(vnDay(booking.checkInDate), 1); d < last; d = addDay(d, 1)) if (d >= today) days.push(d)
  return days
}

/**
 * "Đổi phòng từ ngày…": from the night picked to check-out the guest is in
 * another room (POST /api/bookings/[id]/room { roomId, fromDate }); the
 * nights before keep theirs, the price stays as booked. The rooms offered
 * are the hotel's, free on those nights (other types too).
 */
function MoveFrom({ booking, days, onClose, onDone }: { booking: BookingDetailData; days: string[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('dash.bookings.detail.roomNumber')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const [date, setDate] = React.useState(days[0])
  const [rooms, setRooms] = React.useState<RoomChoice[] | null>(null)
  const [roomId, setRoomId] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const plan = roomPlan(booking)
  const typeId = spanOnNight(plan, date)?.roomTypeId ?? booking.bookingItems[0]?.roomTypeId
  const from = nightStart(booking.checkInDate, date).toISOString()

  React.useEffect(() => {
    const controller = new AbortController()
    setRooms(null)
    setRoomId('')
    const query = new URLSearchParams({
      propertyId: booking.property.id,
      roomTypeId: booking.bookingItems[0]?.roomTypeId ?? '',
      checkIn: from,
      checkOut: booking.checkOutDate,
      all: '1',
      allTypes: '1',
      excludeBookingId: booking.id,
    })
    fetch(`/api/rooms/available?${query}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) setRooms(data?.success && data.meta?.listed ? data.data : [])
      })
      .catch(() => {
        if (!controller.signal.aborted) setRooms([])
      })
    return () => controller.abort()
  }, [booking.id, booking.property.id, booking.bookingItems, booking.checkOutDate, from])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, fromDate: date }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(t('movedFrom', { room: data.data.to, date: labels.dayMonth(from) }), data.data.roomTypeChanged ? t('movedType') : undefined)
        onDone()
      } else {
        toast.error(t('assignFailed'), apiError(data.error))
      }
    } catch {
      toast.error(t('assignFailed'))
    } finally {
      setSaving(false)
    }
  }

  const here = spanOnNight(plan, date)?.roomId
  const free = (rooms ?? []).filter((r) => r.status === 'AVAILABLE' && r.id !== here)
  const groups = [...new Set(free.map((r) => r.roomTypeId))]
    .sort((a, b) => (a === typeId ? -1 : b === typeId ? 1 : 0))
    .map((id) => ({ id, name: free.find((r) => r.roomTypeId === id)!.roomTypeName, rooms: free.filter((r) => r.roomTypeId === id) }))

  return (
    <form
      className="mt-3 space-y-3 rounded-box border border-line bg-raised p-3"
      aria-label={t('moveFromTitle')}
      onSubmit={(e) => {
        e.preventDefault()
        if (roomId) save()
      }}
    >
      <div>
        <p className="text-small font-medium text-fg">{t('moveFromTitle')}</p>
        <p className="text-xs text-muted">{t('moveFromHint')}</p>
      </div>
      <Select label={t('fromNight')} value={date} onChange={(e) => setDate(e.target.value)}>
        {days.map((d) => (
          <option key={d} value={d}>
            {labels.longDate(nightStart(booking.checkInDate, d))}
          </option>
        ))}
      </Select>
      {rooms === null ? (
        <p className="text-small text-muted">{t('loading')}</p>
      ) : free.length === 0 ? (
        <p className="text-small text-muted">{t('noFreeRoom')}</p>
      ) : (
        <Select label={t('toRoom')} value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder={t('choose')}>
          {groups.map((group) => (
            <optgroup key={group.id} label={group.id === typeId ? group.name : t('otherType', { type: group.name })}>
              {group.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          {tc('actions.cancel')}
        </Button>
        <Button type="submit" size="sm" isLoading={saving} disabled={!roomId}>
          {t('submitMove')}
        </Button>
      </div>
    </form>
  )
}

type ActionKey = 'checkin' | 'checkout' | 'noshow' | 'cancel' | 'extend' | 'email'

async function postAction(bookingId: string, path: string, body?: unknown) {
  const res = await fetch(`/api/bookings/${bookingId}/${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

function addDays(iso: string, days: number): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000 + days * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

/**
 * The main action for the booking's state plus the secondary ones
 * (redesign 4b): CONFIRMED / PENDING → Nhận phòng, CHECKED_IN → Trả phòng.
 * `openPageHref` adds "Mở trang đầy đủ" (side panel only).
 */
export function BookingActions({
  booking,
  onChanged,
  openPageHref,
}: {
  booking: BookingDetailData
  onChanged: () => void
  openPageHref?: string
}) {
  const role = useWorkspaceRole()
  const canManage = canManageBookings(role)
  const t = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const [busy, setBusy] = React.useState<ActionKey | null>(null)
  const [dialog, setDialog] = React.useState<'cancel' | 'extend' | 'noshow' | 'checkin' | 'checkout' | null>(null)
  const [extendDate, setExtendDate] = React.useState('')
  const [dialogError, setDialogError] = React.useState('')

  const s = booking.status
  const canCheckIn = s === 'PENDING' || s === 'CONFIRMED'
  const canCheckOut = s === 'CHECKED_IN'
  const canExtend = s === 'CONFIRMED' || s === 'CHECKED_IN'
  const canNoShow = s === 'PENDING' || s === 'CONFIRMED'
  const canCancel = s === 'PENDING' || s === 'CONFIRMED' || s === 'CHECKED_IN'

  const run = async (key: ActionKey, path: string, body: unknown, success: (data: any) => string) => {
    setBusy(key)
    setDialogError('')
    try {
      const data = await postAction(booking.id, path, body)
      if (data.success) {
        toast.success(success(data))
        setDialog(null)
        onChanged()
      } else if (dialog) {
        setDialogError(apiError(data.error) || t('actions.failed'))
      } else {
        toast.error(t('actions.failed'), apiError(data.error))
      }
    } catch {
      toast.error(t('actions.noConnection'))
    } finally {
      setBusy(null)
    }
  }

  const print = () => {
    const html = buildPrintHtml({ ...booking, roomLabel: roomLabel(booking), property: booking.property })
    const w = window.open('', '_blank')
    if (!w) {
      toast.error(t('actions.popupBlocked'), t('actions.popupBlockedHint'))
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
      w.close()
    }, 250)
  }

  const openExtend = () => {
    setExtendDate(addDays(booking.checkOutDate, 1))
    setDialogError('')
    setDialog('extend')
  }

  const primary = !canManage
    ? null
    : canCheckIn
      ? {
          label: t('actions.checkIn'),
          key: 'checkin' as const,
          // Confirmed in the dialog, with the room (check-in-dialog.tsx); it was one click.
          run: () => setDialog('checkin'),
        }
      : canCheckOut
        ? {
            label: t('actions.checkOut'),
            key: 'checkout' as const,
            // The late fee is decided in the dialog (check-out-dialog.tsx).
            run: () => setDialog('checkout'),
          }
        : null

  return (
    <>
      {primary ? (
        <Button className="flex-1" onClick={primary.run} isLoading={busy === primary.key} disabled={!!busy && busy !== primary.key}>
          {primary.label}
        </Button>
      ) : (
        <Button variant="outline" className="flex-1" onClick={print}>
          {t('actions.printSlip')}
        </Button>
      )}
      {canManage && canExtend && (
        <Button variant="outline" onClick={openExtend} disabled={!!busy}>
          {t('actions.extend')}
        </Button>
      )}
      {primary && (
        <Button variant="outline" onClick={print} className="hidden sm:inline-flex">
          {t('actions.printSlip')}
        </Button>
      )}
      <Dropdown
        align="right"
        className="bottom-full mb-2 mt-0"
        trigger={
          <Button variant="outline" aria-label={t('actions.more')} className="px-3">
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </Button>
        }
      >
        {primary && (
          <DropdownItem onClick={print} className="sm:hidden">
            {t('actions.printSlip')}
          </DropdownItem>
        )}
        {canManage && (
          <DropdownItem
            disabled={busy === 'email'}
            onClick={() => run('email', 'send-confirmation', undefined, () => t('actions.confirmationSent'))}
          >
            {t('actions.sendConfirmation')}
          </DropdownItem>
        )}
        {canManage && canNoShow && (
          <DropdownItem onClick={() => { setDialogError(''); setDialog('noshow') }}>{t('actions.markNoShow')}</DropdownItem>
        )}
        {openPageHref && (
          <DropdownItem onClick={() => window.location.assign(openPageHref)}>{t('actions.openFullPage')}</DropdownItem>
        )}
        {/* Dropdown clones each direct child, so no fragments here. */}
        {canManage && canCancel && <DropdownDivider />}
        {canManage && canCancel && (
          <DropdownItem danger onClick={() => setDialog('cancel')}>
            {t('actions.cancelBooking')}
          </DropdownItem>
        )}
      </Dropdown>

      <CheckInDialog
        booking={booking}
        propertyId={booking.property.id}
        checkInTime={booking.property.policy?.checkInTime}
        isOpen={dialog === 'checkin'}
        onClose={() => setDialog(null)}
        onDone={(message) => {
          toast.success(message)
          setDialog(null)
          onChanged()
        }}
      />

      <CheckOutDialog
        bookingId={booking.id}
        bookingCode={booking.bookingCode}
        isOpen={dialog === 'checkout'}
        onClose={() => setDialog(null)}
        onDone={(message) => {
          toast.success(message)
          setDialog(null)
          onChanged()
        }}
      />

      {/* The refund is decided in the dialog (cancel-dialog.tsx). */}
      <CancelDialog
        bookingId={booking.id}
        bookingCode={booking.bookingCode}
        isOpen={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        onDone={(message) => {
          toast.success(message)
          setDialog(null)
          onChanged()
        }}
      />

      <Modal isOpen={dialog === 'extend'} onClose={() => setDialog(null)} size="sm">
        <ModalHeader onClose={() => setDialog(null)}>
          <span className="font-semibold">{t('extendDialog.title', { code: booking.bookingCode })}</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-small text-muted">{t('extendDialog.current', { date: labels.longDate(booking.checkOutDate) })}</p>
          <Input
            type="date"
            label={t('extendDialog.newDate')}
            value={extendDate}
            min={addDays(booking.checkOutDate, 1)}
            onChange={(e) => setExtendDate(e.target.value)}
            hint={t('extendDialog.hint')}
          />
          {dialogError && <p className="text-small text-err">{dialogError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDialog(null)}>
            {tc('actions.close')}
          </Button>
          <Button
            isLoading={busy === 'extend'}
            disabled={!extendDate}
            onClick={() =>
              run('extend', 'extend', { newCheckOutDate: extendDate, addPayment: true, paymentMethod: 'CASH' }, (d) => apiError(d.message) || t('extendDialog.done'))
            }
          >
            {t('actions.extend')}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={dialog === 'noshow'} onClose={() => setDialog(null)} size="sm">
        <ModalHeader onClose={() => setDialog(null)}>
          <span className="font-semibold">{t('noShowDialog.title')}</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-small text-fg">
            {t('noShowDialog.body', { code: booking.bookingCode, guest: booking.guestName })}
          </p>
          {dialogError && <p className="text-small text-err">{dialogError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDialog(null)}>
            {tc('actions.no')}
          </Button>
          <Button isLoading={busy === 'noshow'} onClick={() => run('noshow', 'no-show', undefined, () => t('noShowDialog.done'))}>
            {t('actions.markNoShow')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
