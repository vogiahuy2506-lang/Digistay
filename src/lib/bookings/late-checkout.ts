/**
 * The late check-out fee: charged only after the hotel's check-out time
 * ("Chính sách", default 12:00) on the booked check-out day, Vietnam time.
 *
 * It used to be counted from 12:00 of the day staff pressed "Check-out",
 * by the server's clock (UTC in the container): a guest leaving a day early
 * in the evening paid a fee, and the hotel's own check-out time was never
 * read. The rate is unchanged: half a night's room price per 24 hours late,
 * by the started hour.
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const VN_OFFSET = 7 * HOUR

/** "HH:mm" → minutes after midnight; 12:00 when missing or malformed. */
function minutesOf(time: string | null | undefined): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time?.trim() ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : 12 * 60
}

/** The hotel's check-out time on the booked check-out day (Vietnam time), as an instant. */
export function checkOutDeadline(checkOutDate: Date, checkOutTime?: string | null): Date {
  const vn = new Date(checkOutDate.getTime() + VN_OFFSET)
  const midnightVn = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET
  return new Date(midnightVn + minutesOf(checkOutTime) * 60 * 1000)
}

export function lateCheckoutFee(input: {
  now: Date
  checkInDate: Date
  checkOutDate: Date
  /** Policy.checkOutTime, "HH:mm" */
  checkOutTime?: string | null
  /** the room price for the whole stay (Booking.subtotal) */
  subtotal: number
}): { deadline: Date; hoursLate: number; fee: number } {
  const deadline = checkOutDeadline(input.checkOutDate, input.checkOutTime)
  const late = input.now.getTime() - deadline.getTime()
  if (late <= 0) return { deadline, hoursLate: 0, fee: 0 }
  const hoursLate = Math.ceil(late / HOUR)
  const nights = Math.max(1, Math.ceil((input.checkOutDate.getTime() - input.checkInDate.getTime()) / DAY))
  const nightlyRate = input.subtotal / nights
  return { deadline, hoursLate, fee: Math.round(((nightlyRate * 0.5) / 24) * hoursLate) }
}
