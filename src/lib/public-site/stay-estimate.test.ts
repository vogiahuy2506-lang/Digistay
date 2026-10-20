import { describe, it, expect } from 'vitest'
import { estimateStay, type RoomPricing } from './stay-estimate'

const pricing: RoomPricing = {
  weekdayPrice: 1_000_000,
  weekendPrice: 1_400_000,
  extraAdultPrice: 300_000,
  extraChildPrice: 120_000,
  baseOccupancy: 2,
}

describe('estimateStay', () => {
  it('charges Saturday and Sunday nights at the weekend price', () => {
    // Thu 2026-10-22 → Mon 2026-10-26: Thu, Fri weekday; Sat, Sun weekend.
    const e = estimateStay('2026-10-22', '2026-10-26', 2, 0, pricing)!
    expect(e).toMatchObject({ nights: 4, weekdayNights: 2, weekendNights: 2, base: 4_800_000, extras: 0, total: 4_800_000 })
  })

  it('adds adults above the base occupancy and every child, per night', () => {
    const e = estimateStay('2026-10-19', '2026-10-21', 3, 1, pricing)!
    expect(e.extraAdults).toBe(1)
    expect(e.extraChildren).toBe(1)
    expect(e.extras).toBe((300_000 + 120_000) * 2)
    expect(e.total).toBe(2_000_000 + 840_000)
  })

  it('uses the weekday price on weekends when no weekend price is set', () => {
    expect(estimateStay('2026-10-24', '2026-10-25', 2, 0, { ...pricing, weekendPrice: null })!.total).toBe(1_000_000)
    expect(estimateStay('2026-10-24', '2026-10-25', 2, 0, { ...pricing, weekendPrice: 0 })!.total).toBe(1_000_000)
  })

  it('refuses empty, reversed or zero-night stays', () => {
    expect(estimateStay('', '2026-10-25', 2, 0, pricing)).toBeNull()
    expect(estimateStay('2026-10-25', '2026-10-25', 2, 0, pricing)).toBeNull()
    expect(estimateStay('2026-10-26', '2026-10-25', 2, 0, pricing)).toBeNull()
  })
})
