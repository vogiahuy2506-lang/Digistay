import { describe, it, expect } from 'vitest'
import { formatVnd } from '@/lib/bookings/display'
import { hotelJsonLd, hotelRoomJsonLd, priceRangeOf, schemaTypeOf, type HotelSchemaInput, type RoomSchemaInput } from './hotel-schema'

const ORIGIN = 'https://may-bien.digistay.vn'

const hotel: HotelSchemaInput = {
  id: `${ORIGIN}/#hotel`,
  url: `${ORIGIN}/`,
  locale: 'vi',
  type: 'HOTEL',
  name: 'Mây Biển Boutique Hotel',
  description: 'Khách sạn nhỏ bên biển.',
  phone: '0901 234 567',
  email: 'hello@maybien.vn',
  address: '12 Trần Phú',
  district: 'Sơn Trà',
  city: 'Đà Nẵng',
  country: 'Vietnam',
  latitude: 16.06,
  longitude: 108.24,
  logo: null,
  images: ['https://img.example/cover.jpg', 'data:image/png;base64,AAAA', '/uploads/x.jpg', 'https://img.example/cover.jpg', 'https://img.example/2.jpg'],
  checkInTime: '14:00',
  checkOutTime: '12:00',
  amenities: ['Wi-Fi miễn phí', 'Hồ bơi'],
  prices: [1_200_000, 1_500_000, null, 2_500_000],
}

describe('hotelJsonLd', () => {
  it('describes the hotel from its own data', () => {
    expect(hotelJsonLd(hotel)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      '@id': `${ORIGIN}/#hotel`,
      name: 'Mây Biển Boutique Hotel',
      description: 'Khách sạn nhỏ bên biển.',
      url: `${ORIGIN}/`,
      telephone: '0901 234 567',
      email: 'hello@maybien.vn',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '12 Trần Phú',
        addressLocality: 'Sơn Trà',
        addressRegion: 'Đà Nẵng',
        addressCountry: 'VN',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 16.06, longitude: 108.24 },
      // Absolute http(s) only, once each.
      image: ['https://img.example/cover.jpg', 'https://img.example/2.jpg'],
      checkinTime: '14:00:00',
      checkoutTime: '12:00:00',
      amenityFeature: [
        { '@type': 'LocationFeatureSpecification', name: 'Wi-Fi miễn phí', value: true },
        { '@type': 'LocationFeatureSpecification', name: 'Hồ bơi', value: true },
      ],
      priceRange: `${formatVnd(1_200_000)} – ${formatVnd(2_500_000)}`,
    })
  })

  it('leaves out what the hotel did not fill in', () => {
    const bare = hotelJsonLd({
      ...hotel,
      description: '  ',
      phone: null,
      email: null,
      district: null,
      latitude: null,
      images: ['data:image/png;base64,AAAA'],
      checkInTime: null,
      checkOutTime: null,
      amenities: [],
      prices: [null, 0],
    })
    expect(bare).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      '@id': `${ORIGIN}/#hotel`,
      name: 'Mây Biển Boutique Hotel',
      url: `${ORIGIN}/`,
      address: { '@type': 'PostalAddress', streetAddress: '12 Trần Phú', addressLocality: 'Đà Nẵng', addressCountry: 'VN' },
    })
  })

  it('uses the lodging type of the property, and no check-in for a restaurant', () => {
    expect(schemaTypeOf('RESORT')).toBe('Resort')
    expect(schemaTypeOf('MOTEL')).toBe('Motel')
    expect(schemaTypeOf('HOMESTAY')).toBe('LodgingBusiness')
    expect(schemaTypeOf('VILLA')).toBe('LodgingBusiness')
    expect(schemaTypeOf('OTHER')).toBe('LodgingBusiness')
    const restaurant = hotelJsonLd({ ...hotel, type: 'RESTAURANT' })
    expect(restaurant['@type']).toBe('Restaurant')
    expect(restaurant).not.toHaveProperty('checkinTime')
    expect(restaurant).not.toHaveProperty('priceRange')
  })

  it('drops times that are not HH:mm', () => {
    const odd = hotelJsonLd({ ...hotel, checkInTime: '2pm', checkOutTime: '25:00' })
    expect(odd).not.toHaveProperty('checkinTime')
    expect(odd).not.toHaveProperty('checkoutTime')
  })
})

describe('priceRangeOf', () => {
  it('formats the range in the visitor language', () => {
    // formatVnd's spacing (a no-break space in Vietnamese).
    expect(priceRangeOf([900_000], 'vi')).toBe(formatVnd(900_000, 'vi'))
    expect(priceRangeOf([900_000], 'vi')).toMatch(/^900\.000\s₫$/)
    expect(priceRangeOf([900_000, 900_000], 'en')).toBe('₫900,000')
    expect(priceRangeOf([2_000_000, 900_000], 'en')).toBe('₫900,000 – ₫2,000,000')
    expect(priceRangeOf([], 'vi')).toBeUndefined()
  })
})

const room: RoomSchemaInput = {
  url: `${ORIGIN}/en/rooms/r1`,
  locale: 'en',
  hotel: { id: `${ORIGIN}/#hotel`, type: 'HOTEL', name: 'Mây Biển Boutique Hotel', url: `${ORIGIN}/en` },
  name: 'Deluxe Sea View',
  description: 'A room facing the sea.',
  images: ['https://img.example/r1.jpg'],
  area: 32,
  bed: '1 double bed',
  maxAdults: 2,
  maxChildren: 1,
  amenities: ['Air conditioning'],
  rates: { weekdayPrice: 1_200_000, weekendPrice: 1_500_000 },
}

describe('hotelRoomJsonLd', () => {
  it('is a HotelRoom with its nightly price in VND, availability not claimed', () => {
    const data = hotelRoomJsonLd(room)
    expect(data['@type']).toEqual(['HotelRoom', 'Product'])
    expect(data).toMatchObject({
      name: 'Deluxe Sea View',
      url: `${ORIGIN}/en/rooms/r1`,
      image: ['https://img.example/r1.jpg'],
      floorSize: { '@type': 'QuantitativeValue', value: 32, unitCode: 'MTK' },
      bed: { '@type': 'BedDetails', typeOfBed: '1 double bed' },
      occupancy: { '@type': 'QuantitativeValue', maxValue: 3 },
      containedInPlace: { '@type': 'Hotel', '@id': `${ORIGIN}/#hotel`, name: 'Mây Biển Boutique Hotel' },
      offers: {
        '@type': 'Offer',
        price: 1_200_000,
        priceCurrency: 'VND',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          priceCurrency: 'VND',
          minPrice: 1_200_000,
          maxPrice: 1_500_000,
          unitCode: 'DAY',
          unitText: 'night',
          valueAddedTaxIncluded: true,
        },
      },
    })
    expect(JSON.stringify(data)).not.toMatch(/availability|InStock|rating/i)
  })

  it('gives one price when weekdays and weekends cost the same', () => {
    const offers = hotelRoomJsonLd({ ...room, locale: 'vi', rates: { weekdayPrice: 900_000, weekendPrice: 900_000 } }).offers as Record<string, any>
    expect(offers.price).toBe(900_000)
    expect(offers.priceSpecification).toMatchObject({ price: 900_000, unitText: 'đêm' })
    expect(offers.priceSpecification).not.toHaveProperty('minPrice')
  })

  it('makes no offer for a room without a price', () => {
    const data = hotelRoomJsonLd({ ...room, rates: null, area: null, bed: '', images: [] })
    expect(data['@type']).toBe('HotelRoom')
    expect(data).not.toHaveProperty('offers')
    expect(data).not.toHaveProperty('floorSize')
    expect(data).not.toHaveProperty('bed')
    expect(data).not.toHaveProperty('image')
  })
})
