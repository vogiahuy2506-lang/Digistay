/**
 * The price shown in a room page's booking box. Mirrors what POST
 * /api/bookings charges (src/app/api/bookings/route.ts): Saturday and
 * Sunday nights at the weekend price, adults above the room's base occupancy
 * and every child at the extra-person prices. Keep the two in step.
 */

export interface RoomPricing {
  weekdayPrice: number
  weekendPrice: number | null
  extraAdultPrice: number
  extraChildPrice: number
  baseOccupancy: number
}

export interface StayEstimate {
  nights: number
  weekdayNights: number
  weekendNights: number
  base: number
  extraAdults: number
  extraChildren: number
  extras: number
  total: number
}

/** checkIn / checkOut as yyyy-mm-dd, read as calendar days. */
export function estimateStay(
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number,
  pricing: RoomPricing
): StayEstimate | null {
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  const end = Date.parse(`${checkOut}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null

  const nights = Math.round((end - start) / 86400000)
  let weekendNights = 0
  for (let t = start; t < end; t += 86400000) {
    const day = new Date(t).getUTCDay()
    if (day === 0 || day === 6) weekendNights++
  }
  const weekdayNights = nights - weekendNights
  const weekend = pricing.weekendPrice || pricing.weekdayPrice
  const base = weekdayNights * pricing.weekdayPrice + weekendNights * weekend

  const extraAdults = Math.max(0, adults - pricing.baseOccupancy)
  const extraChildren = Math.max(0, children)
  const extras = (extraAdults * pricing.extraAdultPrice + extraChildren * pricing.extraChildPrice) * nights

  return { nights, weekdayNights, weekendNights, base, extraAdults, extraChildren, extras, total: base + extras }
}
