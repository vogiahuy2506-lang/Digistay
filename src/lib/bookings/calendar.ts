/**
 * Pure helpers of the room calendar (properties/[id]/calendar). Days are the
 * browser's local calendar days, as the calendar grid draws them.
 */

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
