import { describe, it, expect } from 'vitest'
import { nightsOf, quoteStay, ratesFrom, serviceAmount } from './quote'

const d = (s: string) => new Date(s)

describe('rates', () => {
  it("are the room type's own; no price means not bookable", () => {
    expect(ratesFrom({ weekdayPrice: 900_000, weekendPrice: 1_100_000 })).toEqual({
      weekdayPrice: 900_000,
      weekendPrice: 1_100_000,
      extraAdultPrice: 0,
      extraChildPrice: 0,
    })
    expect(ratesFrom(null)).toBeNull()
    expect(ratesFrom({ weekdayPrice: 0, weekendPrice: 500_000 })).toBeNull()
    // No weekend price: the weekday one.
    expect(ratesFrom({ weekdayPrice: 500_000, weekendPrice: 0 })?.weekendPrice).toBe(500_000)
  })

  it("surcharges: the room type's when set, else the property's", () => {
    const defaults = { extraAdultPrice: 150_000, extraChildPrice: 80_000 }
    expect(ratesFrom({ weekdayPrice: 1, weekendPrice: 1 }, defaults)).toMatchObject(defaults)
    expect(ratesFrom({ weekdayPrice: 1, weekendPrice: 1, extraAdultPrice: 200_000 }, defaults)).toMatchObject({
      extraAdultPrice: 200_000,
      extraChildPrice: 80_000,
    })
  })
})

describe('nights', () => {
  it('weekend nights start on Saturday or Sunday in Vietnam time', () => {
    // Fri 4 → Mon 7 Dec 2026: nights of Fri (weekday), Sat, Sun (weekend).
    expect(nightsOf(d('2026-12-04'), d('2026-12-07'))).toEqual({ nights: 3, weekdayNights: 1, weekendNights: 2 })
    // 23:00 UTC on Fri is 06:00 Saturday in Vietnam.
    expect(nightsOf(d('2026-12-04T23:00:00Z'), d('2026-12-05T23:00:00Z')).weekendNights).toBe(1)
    expect(nightsOf(d('2026-12-04'), d('2026-12-04')).nights).toBe(0)
  })
})

describe('quote', () => {
  const rates = { weekdayPrice: 900_000, weekendPrice: 1_100_000, extraAdultPrice: 150_000, extraChildPrice: 80_000 }
  it('room nights + surcharges + services, nothing added on top', () => {
    const q = quoteStay({
      rates,
      checkIn: d('2026-12-04'),
      checkOut: d('2026-12-07'),
      numAdults: 3,
      numChildren: 1,
      baseOccupancy: 2,
      services: [
        { service: { id: 's1', name: 'Đưa đón', price: 300_000, priceType: 'FIXED', perPerson: false }, quantity: 1 },
        { service: { id: 's2', name: 'Ăn sáng', price: 100_000, priceType: 'PER_NIGHT', perPerson: true }, quantity: 1 },
      ],
    })
    expect(q.basePrice).toBe(900_000 + 2 * 1_100_000)
    expect(q.extraAdultCharge).toBe(150_000 * 3)
    expect(q.extraChildCharge).toBe(80_000 * 3)
    expect(q.services.map((s) => s.amount)).toEqual([300_000, 100_000 * 3 * 4])
    expect(q.total).toBe(3_100_000 + 450_000 + 240_000 + 300_000 + 1_200_000)
    expect(q.extraCharges).toBe(q.total - q.basePrice)
  })

  it('services: per stay, per night, per person', () => {
    const s = { id: 'x', name: 'x', price: 50_000, perPerson: false }
    expect(serviceAmount({ ...s, priceType: 'FIXED' }, 2, 3, 2)).toBe(100_000)
    expect(serviceAmount({ ...s, priceType: 'PER_NIGHT' }, 1, 3, 2)).toBe(150_000)
    expect(serviceAmount({ ...s, priceType: 'PER_PERSON' }, 1, 3, 2)).toBe(100_000)
  })
})
