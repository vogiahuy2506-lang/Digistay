/**
 * schema.org structured data for a hotel's site: the hotel on its home page,
 * a room type (with its nightly price) on the room's page. Pure: the pages
 * pass what they already show, and only that. Nothing here is guessed —
 * a field the hotel did not fill in is left out, and no availability or
 * rating is claimed.
 */
import type { Locale } from '@/i18n/locales'
import { formatVnd } from '@/lib/bookings/display'
import { absoluteImageUrl } from './urls'

type Json = Record<string, unknown>

const LODGING_TYPES: Record<string, string> = {
  HOTEL: 'Hotel',
  RESORT: 'Resort',
  MOTEL: 'Motel',
  RESTAURANT: 'Restaurant',
}

/** The schema.org type for a property type; homestays, villas and the rest are LodgingBusiness. */
export function schemaTypeOf(propertyType: string): string {
  return LODGING_TYPES[propertyType] ?? 'LodgingBusiness'
}

const isLodging = (propertyType: string) => propertyType !== 'RESTAURANT'

/** "HH:mm" from the policy → schema.org Time "HH:mm:00"; anything else is left out. */
function schemaTime(value: string | null | undefined): string | undefined {
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? `${value}:00` : undefined
}

const text = (value: string | null | undefined) => (value && value.trim() ? value.trim() : undefined)

/** Distinct absolute http(s) image URLs, in order. */
export function schemaImages(urls: (string | null | undefined)[], max = 10): string[] {
  const out: string[] = []
  for (const url of urls) {
    const abs = absoluteImageUrl(url)
    if (abs && !out.includes(abs)) out.push(abs)
    if (out.length === max) break
  }
  return out
}

/** "1.200.000 ₫ – 2.500.000 ₫" from nightly prices (one price: just it); none → undefined. */
export function priceRangeOf(prices: (number | null | undefined)[], locale: Locale): string | undefined {
  const valid = prices.filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0)
  if (valid.length === 0) return undefined
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  return min === max ? formatVnd(min, locale) : `${formatVnd(min, locale)} – ${formatVnd(max, locale)}`
}

/** Drops undefined, null, '' and empty arrays, so the output only has what is known. */
function compact(obj: Json): Json {
  const out: Json = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return out
}

export interface HotelSchemaInput {
  /** A stable id for the hotel across languages, e.g. https://foo.digistay.vn/#hotel. */
  id: string
  /** The home page in this language. */
  url: string
  locale: Locale
  type: string
  name: string
  description?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  ward?: string | null
  /** Rows saved before July 2025: used when there is no ward. */
  district?: string | null
  /** The province's name. */
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  logo?: string | null
  /** Cover first, then the photos; non-http(s) ones are dropped. */
  images: (string | null | undefined)[]
  /** From the hotel's policy; null when it has none. */
  checkInTime?: string | null
  checkOutTime?: string | null
  /** Amenity names in this language. */
  amenities: string[]
  /** Nightly prices of the room types (weekday and weekend), for priceRange. */
  prices: (number | null | undefined)[]
}

/** The country as schema.org wants it: the hotels are in Vietnam (Property.country defaults to "Vietnam"). */
function countryCode(country: string | null | undefined): string {
  const value = text(country)
  return !value || /^(vn|vi[eệ]t ?nam)$/i.test(value) ? 'VN' : value
}

export function hotelJsonLd(input: HotelSchemaInput): Json {
  const lodging = isLodging(input.type)
  // Vietnamese addresses since July 2025: a ward (phường / xã) in a province;
  // older rows have a district (quận / huyện) instead.
  const locality = text(input.ward) ?? text(input.district)
  const city = text(input.city)
  const address = compact({
    '@type': 'PostalAddress',
    streetAddress: text(input.address),
    addressLocality: locality ?? city,
    addressRegion: locality ? city : undefined,
    addressCountry: countryCode(input.country),
  })
  const hasGeo = typeof input.latitude === 'number' && typeof input.longitude === 'number'
  return compact({
    '@context': 'https://schema.org',
    '@type': schemaTypeOf(input.type),
    '@id': input.id,
    name: input.name,
    description: text(input.description),
    url: input.url,
    telephone: text(input.phone),
    email: text(input.email),
    address,
    geo: hasGeo ? { '@type': 'GeoCoordinates', latitude: input.latitude, longitude: input.longitude } : undefined,
    image: schemaImages(input.images),
    logo: absoluteImageUrl(input.logo) ?? undefined,
    checkinTime: lodging ? schemaTime(input.checkInTime) : undefined,
    checkoutTime: lodging ? schemaTime(input.checkOutTime) : undefined,
    amenityFeature: input.amenities
      .filter((name) => text(name))
      .map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
    priceRange: lodging ? priceRangeOf(input.prices, input.locale) : undefined,
  })
}

export interface RoomSchemaInput {
  /** The room's page in this language. */
  url: string
  locale: Locale
  hotel: { id: string; type: string; name: string; url: string }
  name: string
  description?: string | null
  images: (string | null | undefined)[]
  /** m² */
  area?: number | null
  /** "1 giường đôi", in this language. */
  bed?: string | null
  maxAdults: number
  maxChildren: number
  /** Amenity names in this language. */
  amenities: string[]
  /** The rates a booking is charged (ratesFrom); null: no price yet, so no offer. */
  rates: { weekdayPrice: number; weekendPrice: number } | null
}

/**
 * A room type. With a price it is also a Product, the schema.org way to
 * attach an Offer to a HotelRoom (schema.org/docs/hotels.html): the nightly
 * price in VND, VAT included (src/lib/pricing/quote.ts), without claiming
 * availability, which depends on the dates.
 */
export function hotelRoomJsonLd(input: RoomSchemaInput): Json {
  const prices = input.rates ? [input.rates.weekdayPrice, input.rates.weekendPrice].filter((p) => Number.isFinite(p) && p > 0) : []
  const min = prices.length ? Math.min(...prices) : null
  const max = prices.length ? Math.max(...prices) : null
  const offers =
    min !== null && max !== null
      ? {
          '@type': 'Offer',
          url: input.url,
          price: min,
          priceCurrency: 'VND',
          priceSpecification: compact({
            '@type': 'UnitPriceSpecification',
            priceCurrency: 'VND',
            ...(min === max ? { price: min } : { minPrice: min, maxPrice: max }),
            unitCode: 'DAY',
            unitText: input.locale === 'en' ? 'night' : 'đêm',
            valueAddedTaxIncluded: true,
          }),
        }
      : undefined
  return compact({
    '@context': 'https://schema.org',
    '@type': offers ? ['HotelRoom', 'Product'] : 'HotelRoom',
    name: input.name,
    description: text(input.description),
    url: input.url,
    image: schemaImages(input.images),
    floorSize: input.area && input.area > 0 ? { '@type': 'QuantitativeValue', value: input.area, unitCode: 'MTK' } : undefined,
    bed: text(input.bed) ? { '@type': 'BedDetails', typeOfBed: text(input.bed) } : undefined,
    occupancy: { '@type': 'QuantitativeValue', maxValue: input.maxAdults + input.maxChildren },
    amenityFeature: input.amenities
      .filter((name) => text(name))
      .map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
    containedInPlace: {
      '@type': schemaTypeOf(input.hotel.type),
      '@id': input.hotel.id,
      name: input.hotel.name,
      url: input.hotel.url,
    },
    offers,
  })
}
