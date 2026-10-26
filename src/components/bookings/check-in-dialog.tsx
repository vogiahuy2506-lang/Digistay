'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Select } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'
import { planNumbers, roomPlan, vnDay } from '@/lib/bookings/room-plan'
import { nightsBetween } from '@/lib/bookings/display'

/** What the dialog needs of a booking (GET /api/bookings/[id]). */
export interface CheckInBooking {
  id: string
  bookingCode: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  totalAmount: number
  depositAmount: number
  bookingItems: { roomTypeId: string; roomNumber: string | null; roomId?: string | null }[]
  roomSegments?: { roomId: string | null; roomNumber: string; roomTypeId: string; fromDate: string; toDate: string }[]
}

interface RoomChoice {
  id: string
  number: string
  roomTypeId: string
  roomTypeName: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE'
}

/** "HH:mm" now in Vietnam. */
const vnTime = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(11, 16)

/**
 * Check-in with a confirm step (it used to happen on one click): the guest
 * and dates, the room — picked from the hotel's free rooms when the type
 * has a room list (POST /api/bookings/[id]/room, the same checks as
 * anywhere), else a typed number — a note when it is early, and what is
 * still to collect. Used by the booking panel/page and the calendar.
 */
export function CheckInDialog({
  booking,
  propertyId,
  checkInTime,
  isOpen,
  onClose,
  onDone,
}: {
  booking: CheckInBooking
  propertyId: string
  /** the hotel's check-in time (Policy), "14:00" when unset */
  checkInTime?: string | null
  isOpen: boolean
  onClose: () => void
  /** after a successful check-in, with the message to show */
  onDone: (message: string) => void
}) {
  const t = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const item = booking.bookingItems[0]
  const split = (booking.roomSegments?.length ?? 0) > 1
  const current = item?.roomNumber ?? ''
  // null: loading; listed false: the type has no room list (typed number).
  const [rooms, setRooms] = React.useState<{ listed: boolean; list: RoomChoice[] } | null>(null)
  const [roomId, setRoomId] = React.useState('')
  const [typed, setTyped] = React.useState(current)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!isOpen) return
    setError('')
    setTyped(current)
    setRoomId('')
    if (!item || split) {
      setRooms({ listed: false, list: [] })
      return
    }
    setRooms(null)
    const controller = new AbortController()
    const query = new URLSearchParams({
      propertyId,
      roomTypeId: item.roomTypeId,
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate,
      all: '1',
      allTypes: '1',
      excludeBookingId: booking.id,
    })
    fetch(`/api/rooms/available?${query}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return
        const list: RoomChoice[] = data?.success && data.meta?.listed ? data.data : []
        setRooms({ listed: list.length > 0, list })
        // The stay's room, else the first free room of its type: the receptionist confirms or changes it.
        const mine = list.find((r) => (item.roomId ? r.id === item.roomId : r.number === current))
        const free = list.find((r) => r.roomTypeId === item.roomTypeId && r.status === 'AVAILABLE')
        setRoomId(mine?.id ?? free?.id ?? '')
      })
      .catch(() => {
        if (!controller.signal.aborted) setRooms({ listed: false, list: [] })
      })
    return () => controller.abort()
  }, [isOpen, booking.id, booking.checkInDate, booking.checkOutDate, propertyId, item, current, split])

  const time = checkInTime || '14:00'
  const today = vnDay(new Date())
  const arrival = vnDay(booking.checkInDate)
  const early = today < arrival ? 'day' : today === arrival && vnTime() < time ? 'time' : null
  const due = Math.max(0, booking.totalAmount - booking.depositAmount)
  const mineId = rooms?.list.find((r) => (item?.roomId ? r.id === item.roomId : r.number === current))?.id
  const freeOfType = rooms?.list.filter((r) => r.roomTypeId === item?.roomTypeId && r.status === 'AVAILABLE') ?? []
  const groups = rooms?.listed
    ? [...new Set(rooms.list.map((r) => r.roomTypeId))]
        .sort((a, b) => (a === item?.roomTypeId ? -1 : b === item?.roomTypeId ? 1 : 0))
        .map((id) => ({ id, name: rooms.list.find((r) => r.roomTypeId === id)!.roomTypeName, rooms: rooms.list.filter((r) => r.roomTypeId === id) }))
    : []

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      // The room first, through the usual checks; a refusal stops the check-in.
      const room =
        rooms?.listed && roomId && roomId !== mineId
          ? await fetch(`/api/bookings/${booking.id}/room`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId }),
            })
          : !rooms?.listed && !split && typed.trim() && typed.trim() !== current
            ? await fetch(`/api/bookings/${booking.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomNumber: typed.trim() }),
              })
            : null
      if (room) {
        const data = await room.json()
        if (!data.success) {
          setError(apiError(data.error) || t('checkIn.roomFailed'))
          return
        }
      }
      const res = await fetch(`/api/bookings/${booking.id}/check-in`, { method: 'POST' })
      const data = await res.json()
      if (data.success) onDone(t('actions.checkedIn'))
      else setError(apiError(data.error) || t('actions.failed'))
    } catch {
      setError(t('actions.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader onClose={onClose}>
        <span className="font-semibold">{t('checkIn.title', { code: booking.bookingCode })}</span>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-small text-fg">
          {t('checkIn.guestLine', {
            guest: booking.guestName,
            from: labels.dayMonth(booking.checkInDate),
            to: labels.dayMonth(booking.checkOutDate),
            nights: labels.nights(nightsBetween(booking.checkInDate, booking.checkOutDate)),
          })}
        </p>

        {rooms === null ? (
          <p className="text-small text-muted">{t('detail.roomNumber.loading')}</p>
        ) : split ? (
          <p className="text-small text-fg">{t('checkIn.splitPlan', { plan: planNumbers(roomPlan(booking)) })}</p>
        ) : rooms.listed ? (
          <div className="space-y-1.5">
            <Select label={t('checkIn.room')} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">{t('checkIn.later')}</option>
              {groups.map((group) => (
                <optgroup key={group.id} label={group.id === item?.roomTypeId ? group.name : t('detail.roomNumber.otherType', { type: group.name })}>
                  {group.rooms.map((r) => (
                    <option key={r.id} value={r.id} disabled={r.status !== 'AVAILABLE' && r.id !== mineId}>
                      {r.number}
                      {r.status !== 'AVAILABLE' && r.id !== mineId ? ` · ${r.status === 'OCCUPIED' ? t('checkIn.taken') : r.status === 'MAINTENANCE' ? t('detail.roomNumber.statusMaintenance') : t('detail.roomNumber.statusInactive')}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <p className="text-small text-muted">
              {freeOfType.length === 0 && !mineId ? t('checkIn.noFreeRoom') : !roomId ? t('checkIn.laterHint') : t('checkIn.roomHint')}
            </p>
          </div>
        ) : (
          <Input
            label={t('checkIn.roomNumber')}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('detail.roomNumber.placeholder')}
            hint={t('checkIn.typedHint')}
          />
        )}

        {early && (
          <p className="rounded-ctl bg-warn-soft px-3 py-2 text-small text-fg">
            {early === 'day' ? t('checkIn.earlyDay', { date: labels.longDate(booking.checkInDate) }) : t('checkIn.earlyTime', { time })}
          </p>
        )}
        {due > 0 && (
          <p className="flex justify-between gap-3 rounded-ctl bg-fg/5 px-3 py-2 text-small">
            <span className="text-muted">{t('checkIn.due')}</span>
            <span className="font-semibold text-fg tabular-nums">{labels.money(due)}</span>
          </p>
        )}
        {error && <p className="text-small text-err">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {tc('actions.cancel')}
        </Button>
        <Button isLoading={busy} disabled={rooms === null} onClick={submit}>
          {t('checkIn.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
