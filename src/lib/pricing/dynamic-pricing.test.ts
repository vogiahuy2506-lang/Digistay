import { describe, it, expect } from 'vitest'
import {
  getHolidayForDate,
  isWeekendNight,
  evaluatePricingRule,
  VIETNAMESE_HOLIDAYS,
} from './dynamic-pricing'

describe('Dynamic Pricing Engine (Task 54)', () => {
  describe('Holiday Detection', () => {
    it('detects fixed Gregorian holidays like New Year and Reunification Day', () => {
      // Jan 1
      const newYear = new Date('2026-01-01T04:00:00Z')
      const h1 = getHolidayForDate(newYear)
      expect(h1).not.toBeNull()
      expect(h1?.nameVi).toContain('Tết Dương Lịch')

      // April 30
      const apr30 = new Date('2026-04-30T05:00:00Z')
      const h2 = getHolidayForDate(apr30)
      expect(h2).not.toBeNull()
      expect(h2?.nameVi).toContain('30/4')
    })

    it('detects multi-day festive periods like National Day 2/9 and Lunar New Year', () => {
      // Sep 2, 2026
      const sep2 = new Date('2026-09-02T03:00:00Z')
      const h = getHolidayForDate(sep2)
      expect(h).not.toBeNull()
      expect(h?.nameVi).toContain('Quốc khánh')

      // Feb 17, 2026 (Tết Bính Ngọ)
      const tet = new Date('2026-02-17T03:00:00Z')
      const hTet = getHolidayForDate(tet)
      expect(hTet).not.toBeNull()
      expect(hTet?.nameVi).toContain('Tết Nguyên Đán')
    })

    it('returns null for standard non-holiday dates', () => {
      const normalDay = new Date('2026-06-15T03:00:00Z')
      expect(getHolidayForDate(normalDay)).toBeNull()
    })
  })

  describe('Weekend Night Detection (Vietnam UTC+7)', () => {
    it('correctly identifies Friday and Saturday nights', () => {
      // 2026-11-06 is Friday
      const friday = new Date('2026-11-06T12:00:00Z')
      expect(isWeekendNight(friday)).toBe(true)

      // 2026-11-07 is Saturday
      const saturday = new Date('2026-11-07T12:00:00Z')
      expect(isWeekendNight(saturday)).toBe(true)

      // 2026-11-08 is Sunday night (standard checkout next morning)
      const sunday = new Date('2026-11-08T12:00:00Z')
      expect(isWeekendNight(sunday)).toBe(false)

      // 2026-11-04 is Wednesday
      const wednesday = new Date('2026-11-04T12:00:00Z')
      expect(isWeekendNight(wednesday)).toBe(false)
    })
  })

  describe('Pure Rule Pricing Evaluation', () => {
    const basePrice = 1_000_000

    it('recommends +20% surge when occupancy reaches 80% or higher', () => {
      const rec = evaluatePricingRule({
        currentPrice: basePrice,
        occupancyRate: 0.85,
        isWeekend: false,
        holiday: null,
        leadDays: 5,
      })

      expect(rec.percentageChange).toBe(20)
      expect(rec.suggestedPrice).toBe(1_200_000)
      expect(rec.reasoningVi).toContain('85%')
      expect(rec.reasoningVi).toContain('RevPAR')
      expect(rec.urgency).toBe('HIGH')
    })

    it('recommends +25% surge when falling on a Vietnamese holiday', () => {
      const holiday = VIETNAMESE_HOLIDAYS[0]
      const rec = evaluatePricingRule({
        currentPrice: basePrice,
        occupancyRate: 0.5,
        isWeekend: false,
        holiday,
        leadDays: 14,
      })

      expect(rec.percentageChange).toBe(25)
      expect(rec.suggestedPrice).toBe(1_250_000)
      expect(rec.reasoningVi).toContain(holiday.nameVi)
      expect(rec.urgency).toBe('HIGH')
    })

    it('recommends +15% surge on weekends with healthy demand', () => {
      const rec = evaluatePricingRule({
        currentPrice: basePrice,
        occupancyRate: 0.5,
        isWeekend: true,
        holiday: null,
        leadDays: 8,
      })

      expect(rec.percentageChange).toBe(15)
      expect(rec.suggestedPrice).toBe(1_150_000)
      expect(rec.reasoningVi).toContain('Cuối tuần')
    })

    it('recommends -15% last-minute discount when occupancy is low under 3 days lead time', () => {
      const rec = evaluatePricingRule({
        currentPrice: basePrice,
        occupancyRate: 0.2,
        isWeekend: false,
        holiday: null,
        leadDays: 2,
      })

      expect(rec.percentageChange).toBe(-15)
      expect(rec.suggestedPrice).toBe(850_000)
      expect(rec.reasoningVi).toContain('deal giờ chót')
    })

    it('recommends -10% early-bird incentive on low demand midweek days far out', () => {
      const rec = evaluatePricingRule({
        currentPrice: basePrice,
        occupancyRate: 0.1,
        isWeekend: false,
        holiday: null,
        leadDays: 12,
      })

      expect(rec.percentageChange).toBe(-10)
      expect(rec.suggestedPrice).toBe(900_000)
      expect(rec.reasoningVi).toContain('Early-bird')
    })

    it('maintains current price when demand is balanced', () => {
      const rec = evaluatePricingRule({
        currentPrice: basePrice,
        occupancyRate: 0.5,
        isWeekend: false,
        holiday: null,
        leadDays: 5,
      })

      expect(rec.percentageChange).toBe(0)
      expect(rec.suggestedPrice).toBe(basePrice)
    })
  })
})

