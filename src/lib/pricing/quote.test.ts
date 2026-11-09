import { describe, it, expect } from 'vitest'
import { depositFor, nightsOf, quoteStay, ratesFrom, serviceAmount } from './quote'

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
  it('weekend nights are Friday and Saturday nights (Thứ 6 & Thứ 7) in Vietnam time', () => {
    // Task 42: Đặt T6 13/11 → CN 15/11 (đêm T6 và đêm T7) phải tính là 2 đêm cuối tuần
    expect(nightsOf(d('2026-11-13'), d('2026-11-15'))).toEqual({ nights: 2, weekdayNights: 0, weekendNights: 2 })

    // Đặt CN 15/11 → T2 16/11 (đêm CN) là đêm ngày thường
    expect(nightsOf(d('2026-11-15'), d('2026-11-16'))).toEqual({ nights: 1, weekdayNights: 1, weekendNights: 0 })

    // Fri 4 → Mon 7 Dec 2026: nights of Fri (weekend), Sat (weekend), Sun (weekday).
    expect(nightsOf(d('2026-12-04'), d('2026-12-07'))).toEqual({ nights: 3, weekdayNights: 1, weekendNights: 2 })
    expect(nightsOf(d('2026-12-04'), d('2026-12-04')).nights).toBe(0)
  })

  it('calculates exact quote for weekend stay (T6 13/11 -> CN 15/11: 2 đêm × 700.000 = 1.400.000 đ)', () => {
    const testRates = { weekdayPrice: 600_000, weekendPrice: 700_000, extraAdultPrice: 0, extraChildPrice: 0 }
    const quote = quoteStay({
      rates: testRates,
      checkIn: d('2026-11-13'),
      checkOut: d('2026-11-15'),
      numAdults: 2,
      numChildren: 0,
      baseOccupancy: 2,
    })
    // 2 weekend nights @ 700k = 1,400,000đ (instead of 1,300,000đ with old Sunday bug)
    expect(quote.weekdayNights).toBe(0)
    expect(quote.weekendNights).toBe(2)
    expect(quote.basePrice).toBe(1_400_000)
    expect(quote.total).toBe(1_400_000)
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

describe('depositFor', () => {
  it('is the share of the total rounded up to 1,000 ₫, at most the total, 0 when none', () => {
    expect(depositFor(2_450_000, 30)).toBe(735_000)
    expect(depositFor(2_450_500, 30)).toBe(736_000) // 735,150 → up
    expect(depositFor(1_234_567, 100)).toBe(1_234_567) // never more than the total
    expect(depositFor(1_000_000, 150)).toBe(1_000_000)
    expect(depositFor(1_000_000, 0)).toBe(0)
    expect(depositFor(0, 30)).toBe(0)
  })
})
