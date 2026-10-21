import { describe, it, expect } from 'vitest'
import { DEFAULT_LATE_TIERS, checkOutDeadline, isValidTiers, lateCheckoutFee, lateTiersOf } from './late-checkout'

// A 2-night stay, 2.4M of room: one night is 1.2M. Check-out day: Wed 9 Dec 2026.
const stay = {
  checkInDate: new Date('2026-12-07T00:00:00Z'),
  checkOutDate: new Date('2026-12-09T00:00:00Z'),
  subtotal: 2_400_000,
}
/** An instant on 9 Dec (or `day`) at a Vietnam wall-clock time. */
const vn = (time: string, day = '2026-12-09') => new Date(`${day}T${time}:00+07:00`)

describe('checkOutDeadline', () => {
  it("is the hotel's check-out time on the booked day, Vietnam time, however the date was stored", () => {
    const noonVn = '2026-12-09T05:00:00.000Z'
    expect(checkOutDeadline(new Date('2026-12-09T00:00:00Z'), '12:00').toISOString()).toBe(noonVn) // yyyy-mm-dd
    expect(checkOutDeadline(new Date('2026-12-09T05:00:00Z'), '12:00').toISOString()).toBe(noonVn) // 12:00 VN
    expect(checkOutDeadline(new Date('2026-12-08T17:00:00Z'), '12:00').toISOString()).toBe(noonVn) // VN midnight
    expect(checkOutDeadline(new Date('2026-12-09T00:00:00Z'), '11:30').toISOString()).toBe('2026-12-09T04:30:00.000Z')
  })

  it('falls back to 12:00 when the policy time is missing or malformed', () => {
    for (const time of [null, undefined, '', 'noon', '25:00', '12:60']) {
      expect(checkOutDeadline(new Date('2026-12-09T00:00:00Z'), time).toISOString()).toBe('2026-12-09T05:00:00.000Z')
    }
  })
})

describe('lateCheckoutFee', () => {
  it('nothing up to the check-out time, nor for a guest leaving a day early in the evening', () => {
    expect(lateCheckoutFee({ ...stay, now: vn('12:00') }).fee).toBe(0)
    expect(lateCheckoutFee({ ...stay, now: vn('19:00', '2026-12-08') }).fee).toBe(0) // the old code charged here
  })

  it('the default tiers: until 15:00 30%, until 18:00 50%, later a whole night', () => {
    expect(lateCheckoutFee({ ...stay, now: vn('13:00') })).toMatchObject({ hoursLate: 1, percent: 30, fee: 360_000 })
    expect(lateCheckoutFee({ ...stay, now: vn('15:00') })).toMatchObject({ percent: 30, fee: 360_000 }) // inclusive
    expect(lateCheckoutFee({ ...stay, now: vn('15:01') })).toMatchObject({ percent: 50, fee: 600_000 })
    expect(lateCheckoutFee({ ...stay, now: vn('18:30') })).toMatchObject({ percent: 100, fee: 1_200_000 })
    expect(lateCheckoutFee({ ...stay, now: vn('23:59') })).toMatchObject({ percent: 100 })
  })

  it('the next day: each started 24 hours after the check-out time is a night', () => {
    expect(lateCheckoutFee({ ...stay, now: vn('10:00', '2026-12-10') })).toMatchObject({ percent: 100, fee: 1_200_000 })
    expect(lateCheckoutFee({ ...stay, now: vn('13:00', '2026-12-10') })).toMatchObject({ percent: 200, fee: 2_400_000 })
  })

  it("follows the hotel's check-out time and its own tiers; none at all when it charges none", () => {
    expect(lateCheckoutFee({ ...stay, now: vn('13:00'), checkOutTime: '14:00' }).fee).toBe(0)
    expect(lateCheckoutFee({ ...stay, now: vn('14:30'), checkOutTime: '14:00' }).percent).toBe(30)
    const own = [{ until: '14:00', percent: 20 }, { until: null, percent: 80 }]
    expect(lateCheckoutFee({ ...stay, now: vn('13:30'), tiers: own })).toMatchObject({ percent: 20, fee: 240_000 })
    expect(lateCheckoutFee({ ...stay, now: vn('16:00'), tiers: own })).toMatchObject({ percent: 80, fee: 960_000 })
    expect(lateCheckoutFee({ ...stay, now: vn('20:00'), tiers: [] }).fee).toBe(0)
  })

  it('rounds to the nearest 1,000 ₫ and treats a same-day stay as one night', () => {
    expect(lateCheckoutFee({ ...stay, subtotal: 2_469_134, now: vn('13:00') }).fee).toBe(370_000) // 370,370.1
    const sameDay = { ...stay, checkInDate: stay.checkOutDate, subtotal: 1_200_000 }
    expect(lateCheckoutFee({ ...sameDay, now: vn('13:00') }).fee).toBe(360_000)
  })
})

describe('tiers', () => {
  it('stored null is the default; a bad stored value never breaks check-out', () => {
    expect(lateTiersOf(null)).toEqual(DEFAULT_LATE_TIERS)
    expect(lateTiersOf([{ until: '18:00', percent: 50 }, { until: '15:00', percent: 30 }, { until: null, percent: 100 }])).toEqual(DEFAULT_LATE_TIERS)
    expect(lateTiersOf([])).toEqual([])
  })

  it('valid: empty, or times rising, 0–300 %, and only the last one open-ended', () => {
    expect(isValidTiers(DEFAULT_LATE_TIERS)).toBe(true)
    expect(isValidTiers([])).toBe(true)
    expect(isValidTiers([{ until: null, percent: 100 }])).toBe(true)
    expect(isValidTiers([{ until: '15:00', percent: 30 }])).toBe(false) // no open end
    expect(isValidTiers([{ until: null, percent: 30 }, { until: null, percent: 50 }])).toBe(false)
    expect(isValidTiers([{ until: '15:00', percent: 30 }, { until: '15:00', percent: 50 }, { until: null, percent: 100 }])).toBe(false)
    expect(isValidTiers([{ until: '25:00', percent: 30 }, { until: null, percent: 100 }])).toBe(false)
    expect(isValidTiers([{ until: '15:00', percent: 301 }, { until: null, percent: 100 }])).toBe(false)
    expect(isValidTiers([{ until: '15:00', percent: 1.5 }, { until: null, percent: 100 }])).toBe(false)
    expect(isValidTiers('30%')).toBe(false)
  })
})
