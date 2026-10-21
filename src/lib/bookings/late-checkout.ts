/**
 * The late check-out fee, as a suggestion staff apply, change or waive at
 * check-out (POST /api/bookings/[id]/check-out). Pure, so the dialog and
 * the server compute the same number.
 *
 * - Late means after the hotel's check-out time ("Chính sách", default
 *   12:00) on the booked check-out day, Vietnam time. It used to be counted
 *   from 12:00 of the day staff pressed "Check-out", by the server's clock.
 * - The hotel's tiers (Policy.lateCheckoutTiers): a share of one night's
 *   room price by the time the guest leaves that day. Default, the common
 *   practice in Vietnam: until 15:00 30%, until 18:00 50%, later 100%. An
 *   empty list: no late fee. From the next day on, each started 24 hours
 *   after the check-out time is a whole night (an overstay; better extended).
 * - One night = the booking's room price per night (subtotal / nights), no
 *   surcharges or services. Rounded to the nearest 1,000 ₫.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const VN_OFFSET = 7 * HOUR
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** A share of one night for leaving by `until` ("HH:mm" on the check-out day); null = any later time. */
export interface LateTier {
  until: string | null
  percent: number
}

export const DEFAULT_LATE_TIERS: LateTier[] = [
  { until: '15:00', percent: 30 },
  { until: '18:00', percent: 50 },
  { until: null, percent: 100 },
]

/** "HH:mm" → minutes after midnight; `fallback` when missing or malformed. */
function minutesOf(time: string | null | undefined, fallback = 12 * 60): number {
  const m = TIME.exec(time?.trim() ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
}

/**
 * The tiers as stored (Policy.lateCheckoutTiers): null → the default; a
 * valid list as is; anything else → the default, never a crash at check-out.
 */
export function lateTiersOf(stored: unknown): LateTier[] {
  if (stored == null) return DEFAULT_LATE_TIERS
  return isValidTiers(stored) ? stored : DEFAULT_LATE_TIERS
}

/** Empty, or times rising, each 0–300 %, and the last one open-ended (until null). */
export function isValidTiers(value: unknown): value is LateTier[] {
  if (!Array.isArray(value)) return false
  if (value.length === 0) return true
  if (value.length > 5) return false
  let previous = -1
  for (const [i, tier] of value.entries()) {
    if (!tier || typeof tier !== 'object') return false
    const { until, percent } = tier as LateTier
    if (!Number.isInteger(percent) || percent < 0 || percent > 300) return false
    const last = i === value.length - 1
    if (last !== (until === null)) return false
    if (!last) {
      if (typeof until !== 'string' || !TIME.test(until)) return false
      const minutes = minutesOf(until)
      if (minutes <= previous) return false
      previous = minutes
    }
  }
  return true
}

/** The hotel's check-out time on the booked check-out day (Vietnam time), as an instant. */
export function checkOutDeadline(checkOutDate: Date, checkOutTime?: string | null): Date {
  return new Date(vnMidnight(checkOutDate) + minutesOf(checkOutTime) * MINUTE)
}

function vnMidnight(date: Date): number {
  const vn = new Date(date.getTime() + VN_OFFSET)
  return Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET
}

export interface LateCheckoutQuote {
  deadline: Date
  hoursLate: number
  /** share of one night, 0 when on time */
  percent: number
  nightlyRate: number
  fee: number
}

export function lateCheckoutFee(input: {
  now: Date
  checkInDate: Date
  checkOutDate: Date
  /** Policy.checkOutTime, "HH:mm" */
  checkOutTime?: string | null
  /** Policy.lateCheckoutTiers as stored (null: the default) */
  tiers?: unknown
  /** the room price for the whole stay (Booking.subtotal) */
  subtotal: number
}): LateCheckoutQuote {
  const deadline = checkOutDeadline(input.checkOutDate, input.checkOutTime)
  const nights = Math.max(1, Math.ceil((input.checkOutDate.getTime() - input.checkInDate.getTime()) / DAY))
  const nightlyRate = input.subtotal / nights
  const late = input.now.getTime() - deadline.getTime()
  const tiers = lateTiersOf(input.tiers)
  if (late <= 0 || tiers.length === 0) return { deadline, hoursLate: 0, percent: 0, nightlyRate, fee: 0 }

  const hoursLate = Math.ceil(late / HOUR)
  const dayEnd = vnMidnight(input.checkOutDate) + DAY
  let percent: number
  if (input.now.getTime() < dayEnd) {
    // Still the check-out day: the first tier the guest left by (inclusive).
    const minute = Math.floor((input.now.getTime() - vnMidnight(input.checkOutDate)) / MINUTE)
    percent = tiers.find((t) => t.until !== null && minute <= minutesOf(t.until))?.percent ?? tiers[tiers.length - 1].percent
  } else {
    percent = 100 * Math.ceil(late / DAY)
  }
  return { deadline, hoursLate, percent, nightlyRate, fee: Math.round((nightlyRate * percent) / 100 / 1000) * 1000 }
}
