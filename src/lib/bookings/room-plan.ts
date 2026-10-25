/**
 * A stay's rooms night by night (mid-stay room changes, rooms.ts). Pure, so
 * the server's checks and the dashboard's screens read one plan.
 *
 * - A stay in one room has no segments: its booking item holds the room. A
 *   split stay has BookingRoomSegment rows covering its nights end to end;
 *   its item keeps the first night's room.
 * - Nights are Vietnam days: the night of 25/10 starts on the 25th and ends
 *   the next morning. Segments meet at check-in's time of day (check-in + n
 *   days), so they line up with the stay's own dates and with the other
 *   stays of the hotel, booked the same way.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const VN_MS = 7 * 60 * 60 * 1000

type Instant = Date | string

/** yyyy-mm-dd: the Vietnam day of an instant. */
export const vnDay = (at: Instant) => new Date(new Date(at).getTime() + VN_MS).toISOString().slice(0, 10)

/** Whole days from one yyyy-mm-dd to another. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

/** The yyyy-mm-dd `n` days after `day`. */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

/** A real yyyy-mm-dd (not 2026-02-30). */
export const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && addDays(value, 0) === value

/** The instant the night of `day` starts in a stay: check-in's time of day, on that Vietnam day. */
export const nightStart = (checkIn: Instant, day: string) => new Date(new Date(checkIn).getTime() + daysBetween(vnDay(checkIn), day) * DAY_MS)

export interface RoomRef {
  roomId: string | null
  roomNumber: string | null
  roomTypeId: string
}

export interface RoomSpan extends RoomRef {
  from: Date
  to: Date
}

export interface PlannedStay {
  checkInDate: Instant
  checkOutDate: Instant
  bookingItems: { roomId?: string | null; roomNumber: string | null; roomTypeId: string }[]
  roomSegments?: { roomId: string | null; roomNumber: string; roomTypeId: string; fromDate: Instant; toDate: Instant }[] | null
}

/** The stay's rooms in night order: its segments once split, else one span in its item's room. */
export function roomPlan(stay: PlannedStay): RoomSpan[] {
  if (stay.roomSegments?.length) {
    return stay.roomSegments
      .map((s) => ({ roomId: s.roomId, roomNumber: s.roomNumber, roomTypeId: s.roomTypeId, from: new Date(s.fromDate), to: new Date(s.toDate) }))
      .sort((a, b) => a.from.getTime() - b.from.getTime())
  }
  const item = stay.bookingItems[0]
  if (!item) return []
  return [{ roomId: item.roomId ?? null, roomNumber: item.roomNumber, roomTypeId: item.roomTypeId, from: new Date(stay.checkInDate), to: new Date(stay.checkOutDate) }]
}

/** The span the guest sleeps in the night of `day` (yyyy-mm-dd, Vietnam); null outside the stay. */
export function spanOnNight(plan: RoomSpan[], day: string): RoomSpan | null {
  return plan.find((s) => vnDay(s.from) <= day && day < vnDay(s.to)) ?? null
}

/**
 * The one room to show for a stay "now": tonight's while it lasts, the
 * first night's before it starts, the last night's after (check-out day).
 */
export function currentSpan(plan: RoomSpan[], today: string): RoomSpan | null {
  if (plan.length === 0) return null
  return spanOnNight(plan, today) ?? (today < vnDay(plan[0].from) ? plan[0] : plan[plan.length - 1])
}

const sameRoom = (a: RoomRef, b: RoomRef) => a.roomId === b.roomId && a.roomNumber === b.roomNumber && a.roomTypeId === b.roomTypeId

/** `plan` with the nights [from, to) in `room`; neighbouring spans in one room become one. */
export function withNightsIn(plan: RoomSpan[], from: Date, to: Date, room: RoomRef): RoomSpan[] {
  const pieces: RoomSpan[] = [{ ...room, from, to }]
  for (const span of plan) {
    if (span.from < from) pieces.push({ ...span, to: new Date(Math.min(span.to.getTime(), from.getTime())) })
    if (span.to > to) pieces.push({ ...span, from: new Date(Math.max(span.from.getTime(), to.getTime())) })
  }
  pieces.sort((a, b) => a.from.getTime() - b.from.getTime())
  const out: RoomSpan[] = []
  for (const piece of pieces) {
    const last = out[out.length - 1]
    if (last && sameRoom(last, piece) && last.to.getTime() === piece.from.getTime()) last.to = piece.to
    else out.push({ ...piece })
  }
  return out
}

/** The spans of the plan that share a night with [from, to). */
export const spansWithin = (plan: RoomSpan[], from: Date, to: Date) => plan.filter((s) => s.from < to && s.to > from)

/**
 * The runs of nights in [from, to) the stay spends in another room type
 * now: putting them in a room of `roomTypeId` moves its inventory there.
 */
export function nightsOutsideType(plan: RoomSpan[], from: Date, to: Date, roomTypeId: string): { from: Date; to: Date }[] {
  const runs: { from: Date; to: Date }[] = []
  for (const span of spansWithin(plan, from, to)) {
    if (span.roomTypeId === roomTypeId) continue
    const run = { from: new Date(Math.max(span.from.getTime(), from.getTime())), to: new Date(Math.min(span.to.getTime(), to.getTime())) }
    const last = runs[runs.length - 1]
    if (last && last.to.getTime() === run.from.getTime()) last.to = run.to
    else runs.push(run)
  }
  return runs
}

/** "101 → 205": a split stay's rooms in night order; one number otherwise, '' while it has none. */
export const planNumbers = (plan: RoomSpan[]) => plan.map((s) => s.roomNumber ?? '–').join(' → ').replace(/^–$/, '')
