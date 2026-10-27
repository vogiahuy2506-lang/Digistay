import { describe, it, expect } from 'vitest'
import type { Plan } from '@/lib/marketing/plans'
import { planToFit, readPlanLimitFacts } from './plan-fit'
import type { Usage } from './limits'

// Starter 1 / 15 / 3 / 0, Growth 3 / 60 / 10 / 100, Business 10 / 300 / 30 / 500 (src/lib/marketing/plans.ts).
const usage = (u: Partial<Usage> = {}): Usage => ({ properties: 1, rooms: 10, staff: 2, invoices: 0, ...u })

describe('planToFit', () => {
  it('suggests the next plan up when the current one is full', () => {
    expect(planToFit(usage(), 'properties', 1)).toBe('growth')
    expect(planToFit(usage({ properties: 3 }), 'properties', 1)).toBe('business')
    expect(planToFit(usage({ staff: 3 }), 'staff', 1)).toBe('growth')
    expect(planToFit(usage({ staff: 10 }), 'staff', 1)).toBe('business')
  })

  it('counts everything being added, not one more', () => {
    expect(planToFit(usage({ rooms: 10 }), 'rooms', 50)).toBe('growth')
    expect(planToFit(usage({ rooms: 10 }), 'rooms', 51)).toBe('business')
  })

  it('suggests the cheapest plan with e-invoices when the plan has none', () => {
    expect(planToFit(usage(), 'invoices', 1)).toBe('growth')
    expect(planToFit(usage({ invoices: 100 }), 'invoices', 1)).toBe('business')
  })

  it('is null when even the biggest plan is too small', () => {
    expect(planToFit(usage({ properties: 10 }), 'properties', 1)).toBeNull()
    expect(planToFit(usage({ rooms: 290 }), 'rooms', 20)).toBeNull()
    expect(planToFit(usage({ invoices: 500 }), 'invoices', 1)).toBeNull()
  })

  it('skips a plan that fits the kind but leaves another limit passed', () => {
    // A workspace over its rooms for now (moved down to Starter with 80 rooms):
    // Growth has room for the staff account but not for the rooms.
    expect(planToFit(usage({ staff: 3, rooms: 80 }), 'staff', 1)).toBe('business')
    expect(planToFit(usage({ staff: 3, rooms: 400 }), 'staff', 1)).toBeNull()
  })

  it('takes the cheapest fitting plan whatever the order of the list', () => {
    const plans: Plan[] = [
      { id: 'business', price: 10, properties: 10, rooms: 300, staff: 30, invoices: 500 },
      { id: 'growth', price: 5, properties: 3, rooms: 60, staff: 10, invoices: 100 },
    ]
    expect(planToFit(usage(), 'properties', 1, plans)).toBe('growth')
  })

  it('treats nothing added as fitting the current usage', () => {
    expect(planToFit(usage(), 'properties', 0)).toBe('starter')
    expect(planToFit(usage(), 'properties', -2)).toBe('starter')
  })
})

describe('readPlanLimitFacts', () => {
  const facts = { kind: 'properties', used: 3, limit: 3, adding: 1, plan: 'growth', suggested: 'business' }

  it('reads well-formed facts, a null suggestion included', () => {
    expect(readPlanLimitFacts(facts)).toEqual(facts)
    expect(readPlanLimitFacts({ ...facts, suggested: null })).toEqual({ ...facts, suggested: null })
  })

  it('ignores anything else', () => {
    expect(readPlanLimitFacts(undefined)).toBeNull()
    expect(readPlanLimitFacts('properties')).toBeNull()
    expect(readPlanLimitFacts({ ...facts, kind: 'bookings' })).toBeNull()
    expect(readPlanLimitFacts({ ...facts, used: '3' })).toBeNull()
    expect(readPlanLimitFacts({ ...facts, limit: -1 })).toBeNull()
    expect(readPlanLimitFacts({ ...facts, plan: 'enterprise' })).toBeNull()
    expect(readPlanLimitFacts({ ...facts, suggested: undefined })).toBeNull()
  })
})
