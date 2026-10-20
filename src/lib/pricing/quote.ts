/**
 * The price of a stay, the same everywhere: the quote on the public site,
 * the staff's estimate, and what a booking or an extension is charged
 * (src/lib/bookings/create-booking.ts). Pure, so pages can import it too.
 *
 * - Room price: the room type's own weekday/weekend price, the one entered
 *   on the "Hạng phòng" page. A room type without a price is not bookable:
 *   it used to be charged the property's "Bảng giá" price, set once from
 *   the first room type, so a Deluxe could be billed at Standard's rate.
 * - Surcharges per extra adult/child per night: the room type's when set,
 *   otherwise the property's "Bảng giá" (extra adults are those above the
 *   room's base occupancy).
 * - Weekend nights are those starting on a Saturday or Sunday, Vietnam time.
 * - Prices include VAT (Part 6): nothing is added on top.
 */

export interface Rates {
  weekdayPrice: number
  weekendPrice: number
  extraAdultPrice: number
  extraChildPrice: number
}

type PriceRow = { weekdayPrice: number; weekendPrice: number; extraAdultPrice?: number; extraChildPrice?: number }

/**
 * A room type's rates from its newest price row, the property's surcharges
 * as fallback. null when the room type has no price: it cannot be booked.
 */
export function ratesFrom(row: PriceRow | null | undefined, propertyDefaults?: Partial<Rates> | null): Rates | null {
  if (!row || !(row.weekdayPrice > 0)) return null
  return {
    weekdayPrice: row.weekdayPrice,
    weekendPrice: row.weekendPrice > 0 ? row.weekendPrice : row.weekdayPrice,
    extraAdultPrice: row.extraAdultPrice && row.extraAdultPrice > 0 ? row.extraAdultPrice : propertyDefaults?.extraAdultPrice ?? 0,
    extraChildPrice: row.extraChildPrice && row.extraChildPrice > 0 ? row.extraChildPrice : propertyDefaults?.extraChildPrice ?? 0,
  }
}

const DAY = 24 * 60 * 60 * 1000
const VN_OFFSET = 7 * 60 * 60 * 1000

/** Nights between two dates, and how many start on a weekend (Vietnam time). */
export function nightsOf(checkIn: Date, checkOut: Date) {
  const nights = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / DAY))
  let weekend = 0
  for (let i = 0; i < nights; i++) {
    const day = new Date(checkIn.getTime() + i * DAY + VN_OFFSET).getUTCDay()
    if (day === 0 || day === 6) weekend++
  }
  return { nights, weekendNights: weekend, weekdayNights: nights - weekend }
}

export interface StayQuote {
  nights: number
  weekdayNights: number
  weekendNights: number
  /** room price for all nights */
  basePrice: number
  extraAdults: number
  extraChildren: number
  extraAdultCharge: number
  extraChildCharge: number
  /** surcharges and services */
  extraCharges: number
  services: ServiceLine[]
  total: number
}

export interface ServiceLine {
  serviceId: string
  name: string
  quantity: number
  amount: number
}

export interface PricedService {
  id: string
  name: string
  price: number
  /** FIXED, PER_NIGHT or PER_PERSON */
  priceType: string
  perPerson: boolean
}

/** One service: × nights when per night, × guests when per person. */
export function serviceAmount(service: PricedService, quantity: number, nights: number, guests: number) {
  const perNight = service.priceType === 'PER_NIGHT' ? Math.max(1, nights) : 1
  const perGuest = service.priceType === 'PER_PERSON' || service.perPerson ? Math.max(1, guests) : 1
  return Math.round(service.price * Math.max(1, quantity) * perNight * perGuest)
}

export function quoteStay(input: {
  rates: Rates
  checkIn: Date
  checkOut: Date
  numAdults: number
  numChildren: number
  /** guests included in the room price */
  baseOccupancy: number
  services?: { service: PricedService; quantity: number }[]
}): StayQuote {
  const { nights, weekdayNights, weekendNights } = nightsOf(input.checkIn, input.checkOut)
  const basePrice = weekdayNights * input.rates.weekdayPrice + weekendNights * input.rates.weekendPrice
  const extraAdults = Math.max(0, input.numAdults - input.baseOccupancy)
  const extraChildren = Math.max(0, input.numChildren)
  const extraAdultCharge = extraAdults * input.rates.extraAdultPrice * nights
  const extraChildCharge = extraChildren * input.rates.extraChildPrice * nights
  const guests = input.numAdults + input.numChildren
  const services = (input.services ?? []).map(({ service, quantity }) => ({
    serviceId: service.id,
    name: service.name,
    quantity: Math.max(1, quantity),
    amount: serviceAmount(service, quantity, nights, guests),
  }))
  const servicesTotal = services.reduce((sum, s) => sum + s.amount, 0)
  const extraCharges = extraAdultCharge + extraChildCharge + servicesTotal
  return {
    nights,
    weekdayNights,
    weekendNights,
    basePrice,
    extraAdults,
    extraChildren,
    extraAdultCharge,
    extraChildCharge,
    extraCharges,
    services,
    total: basePrice + extraCharges,
  }
}
