/**
 * Helpers of the bookings calendar (properties/[id]/calendar) and of the
 * overview's "today at the hotel" (src/components/property/today-overview.tsx),
 * which read the same bookings. Days are the browser's local calendar days,
 * as the calendar grid draws them.
 */

import { currentSpan, roomPlan, spanOnNight, type PlannedStay } from './room-plan'

type Stay = { checkInDate: string | Date; checkOutDate: string | Date }

const DAY_MS = 24 * 60 * 60 * 1000

function localDay(value: string | Date): number {
  const d = new Date(value)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * The guest sleeps there the night of `day`: from the check-in day up to,
 * not including, the check-out day. Occupancy counts nights; counting the
 * check-out day too made a one-night stay take a room for two days.
 */
export function staysNight(booking: Stay, day: Date): boolean {
  const d = localDay(day)
  return localDay(booking.checkInDate) <= d && d < localDay(booking.checkOutDate)
}

/**
 * How far around the days shown the calendar asks for bookings. The list API
 * only returns bookings that check in on or after `startDate` and check out
 * by `endDate`, so a stay crossing the edge of the month was missing from
 * both months; asking this much wider and filtering here catches every stay
 * shorter than this.
 */
export const CALENDAR_FETCH_MARGIN_DAYS = 60

/** [from, to) widened by the margin, as the list API's startDate / endDate. */
export function fetchWindow(from: Date, to: Date): { startDate: string; endDate: string } {
  return {
    startDate: new Date(localDay(from) - CALENDAR_FETCH_MARGIN_DAYS * DAY_MS).toISOString(),
    endDate: new Date(localDay(to) + CALENDAR_FETCH_MARGIN_DAYS * DAY_MS).toISOString(),
  }
}

/**
 * Every booking of the property the list API returns for [from, to) widened
 * by the margin, all pages: the API caps a page at 100 (the calendar asked
 * for 200 and silently got 100), so it follows the pages, at most 20.
 */
export async function fetchBookingsAround<B>(propertyId: string, from: Date, to: Date): Promise<B[]> {
  const { startDate, endDate } = fetchWindow(from, to)
  const found: B[] = []
  for (let page = 1, pages = 1; page <= pages && page <= 20; page++) {
    const res = await fetch(
      `/api/bookings?propertyId=${encodeURIComponent(propertyId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=100&page=${page}`
    )
    const data = await res.json()
    if (!data.success) break
    found.push(...(data.data ?? []))
    pages = data.pagination?.totalPages ?? 1
  }
  return found
}

/** A booking as the calendar and the overview read it (a row of GET /api/bookings). */
export interface CalendarBooking extends PlannedStay {
  status: string
  numAdults?: number | null
  numChildren?: number | null
  /** Not a number when the API keeps amounts from the caller's role. */
  totalAmount?: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** yyyy-mm-dd of a local day (room-plan.ts reads nights by that key). */
export const dayKey = (day: Date) => `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`

/** A cancelled or no-show booking holds no room and brings no money. */
export const holdsRoom = (b: { status: string }) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW'

const sameDay = (value: string | Date, day: Date) => localDay(value) === localDay(day)

/** Rooms taken the night of `day`, per room type (a booking's check-out day is free). */
export function nightOccupancy(bookings: CalendarBooking[], day: Date): Map<string, number> {
  const result = new Map<string, number>()
  for (const b of bookings) {
    if (!holdsRoom(b) || !staysNight(b, day)) continue
    // A stay that changes rooms counts in the type of that night's room.
    const part = b.roomSegments?.length ? spanOnNight(roomPlan(b), dayKey(day)) : null
    for (const item of part ? [part] : b.bookingItems) {
      result.set(item.roomTypeId, (result.get(item.roomTypeId) ?? 0) + 1)
    }
  }
  return result
}

/** Rooms taken the night of `day`, all types together. */
export const roomsTakenOn = (bookings: CalendarBooking[], day: Date) =>
  [...nightOccupancy(bookings, day).values()].reduce((sum, taken) => sum + taken, 0)

/** Booked room-nights over the room-nights the hotel has in a month (0-11), in %; 0 without rooms. */
export function monthOccupancy(bookings: CalendarBooking[], totalRooms: number, year: number, month: number): number {
  if (totalRooms <= 0) return 0
  const days = new Date(year, month + 1, 0).getDate()
  let occupied = 0
  for (let d = 1; d <= days; d++) occupied += roomsTakenOn(bookings, new Date(year, month, d))
  return (occupied / (totalRooms * days)) * 100
}

/** The month's live bookings by arrival (0-11): how many, how many still pending, and what they total. */
export function monthArrivals(bookings: CalendarBooking[], year: number, month: number) {
  let count = 0
  let pending = 0
  let total = 0
  for (const b of bookings) {
    if (!holdsRoom(b)) continue
    const arrival = new Date(b.checkInDate)
    if (arrival.getFullYear() !== year || arrival.getMonth() !== month) continue
    count++
    if (b.status === 'PENDING') pending++
    total += Number(b.totalAmount) || 0
  }
  return { count, pending, total }
}

/** Who is in house now: the checked-in stays and their guests. */
export function inHouse(bookings: CalendarBooking[]) {
  let stays = 0
  let guests = 0
  for (const b of bookings) {
    if (b.status !== 'CHECKED_IN') continue
    stays++
    guests += (b.numAdults ?? 0) + (b.numChildren ?? 0)
  }
  return { stays, guests }
}

/** Guests expected on `day`: confirmed or pending stays that check in that day. */
export const arrivalsOn = <B extends CalendarBooking>(bookings: B[], day: Date) =>
  bookings.filter((b) => (b.status === 'CONFIRMED' || b.status === 'PENDING') && sameDay(b.checkInDate, day))

/** Guests due out on `day`: checked-in stays that check out that day. */
export const departuresOn = <B extends CalendarBooking>(bookings: B[], day: Date) =>
  bookings.filter((b) => b.status === 'CHECKED_IN' && sameDay(b.checkOutDate, day))

/**
 * The room a stay is in on a local day: that night's for a stay that
 * changes rooms, the last one on its check-out day.
 */
export const roomOn = (b: PlannedStay, day: Date): string | null => currentSpan(roomPlan(b), dayKey(day))?.roomNumber ?? null

/**
 * One CSV field. Quoted when it holds a comma, quote or line break (a guest
 * name with a comma shifted every column after it). A field starting with
 * = + - @ or a tab is prefixed with ' so a spreadsheet shows it as text
 * instead of running it as a formula (guest names come from the public
 * booking form).
 */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
