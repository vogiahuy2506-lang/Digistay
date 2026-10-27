import { describe, it, expect } from 'vitest'
import { usageLevel, usageNotices } from './usage-alerts'

const growth = { properties: 3, rooms: 60, staff: 10, invoices: 100 }
const none = { properties: 0, rooms: 0, staff: 0, invoices: 0 }

describe('usage alerts', () => {
  it('says 80% from 80% of a limit of 5 or more, and 100% at a limit above 1', () => {
    expect(usageLevel(7, 10)).toBe(0)
    expect(usageLevel(8, 10)).toBe(80)
    expect(usageLevel(10, 10)).toBe(100)
    expect(usageLevel(12, 10)).toBe(100)
    // Small limits: 2 of 3 says nothing, 3 of 3 is full; Starter's single property is not news.
    expect(usageLevel(2, 3)).toBe(0)
    expect(usageLevel(3, 3)).toBe(100)
    expect(usageLevel(1, 1)).toBe(0)
    // Not in the plan (Starter's e-invoices).
    expect(usageLevel(0, 0)).toBe(0)
  })

  it('tells each level once, and again after going back under it', () => {
    const first = usageNotices({}, { ...none, staff: 8, properties: 3 }, growth, '2026-10')
    expect(first.notices).toEqual([
      { kind: 'properties', level: 100 },
      { kind: 'staff', level: 80 },
    ])
    expect(first.told).toEqual({ properties: 100, staff: 80 })

    // Nothing new: nothing told.
    expect(usageNotices(first.told, { ...none, staff: 9, properties: 3 }, growth, '2026-10').notices).toEqual([])
    // 80% → 100%: told again.
    expect(usageNotices(first.told, { ...none, staff: 10, properties: 3 }, growth, '2026-10').notices).toEqual([{ kind: 'staff', level: 100 }])

    // A property deleted: forgotten, so a new third one tells again.
    const fewer = usageNotices(first.told, { ...none, staff: 8, properties: 2 }, growth, '2026-10')
    expect(fewer).toEqual({ notices: [], told: { staff: 80 } })
    expect(usageNotices(fewer.told, { ...none, staff: 8, properties: 3 }, growth, '2026-10').notices).toEqual([{ kind: 'properties', level: 100 }])
  })

  it('counts e-invoices per month', () => {
    const october = usageNotices({}, { ...none, invoices: 85 }, growth, '2026-10')
    expect(october.notices).toEqual([{ kind: 'invoices', level: 80 }])
    expect(october.told).toEqual({ invoices: { month: '2026-10', level: 80 } })
    expect(usageNotices(october.told, { ...none, invoices: 90 }, growth, '2026-10').notices).toEqual([])
    // A new month starts over: 80% again is news.
    expect(usageNotices(october.told, { ...none, invoices: 80 }, growth, '2026-11').notices).toEqual([{ kind: 'invoices', level: 80 }])
    // Under 80% in the new month: the old month is dropped.
    expect(usageNotices(october.told, { ...none, invoices: 3 }, growth, '2026-11').told).toEqual({})
  })
})
