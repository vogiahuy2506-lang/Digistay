import { describe, it, expect } from 'vitest'
import { canRestore, guestsBookedWhere, purgeAt, purgeCutoff, restoreDaysLeft, sameName, vietnamDayStart } from './rules'

const DAY = 86_400_000

describe('deletion rules', () => {
  it('restorable for 30 days, then due for the purge', () => {
    const deletedAt = new Date('2026-10-27T03:00:00Z')
    expect(purgeAt(deletedAt).toISOString()).toBe('2026-11-26T03:00:00.000Z')
    expect(canRestore(deletedAt, new Date(deletedAt.getTime() + 30 * DAY - 1))).toBe(true)
    expect(canRestore(deletedAt, new Date(deletedAt.getTime() + 30 * DAY))).toBe(false)
    const now = new Date('2026-12-01T00:00:00Z')
    expect(purgeCutoff(now).toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })

  it('counts the days left rounded up, never below 0', () => {
    const deletedAt = new Date('2026-10-27T03:00:00Z')
    expect(restoreDaysLeft(deletedAt, new Date(deletedAt.getTime() + 60_000))).toBe(30)
    expect(restoreDaysLeft(deletedAt, new Date(deletedAt.getTime() + 29.5 * DAY))).toBe(1)
    expect(restoreDaysLeft(deletedAt, new Date(deletedAt.getTime() + 31 * DAY))).toBe(0)
  })

  it('takes the name typed with any letter case, extra spaces or decomposed accents', () => {
    expect(sameName('Khách sạn Demo Hà Nội', 'Khách sạn Demo Hà Nội')).toBe(true)
    expect(sameName('  khách sạn   demo hà nội ', 'Khách sạn Demo Hà Nội')).toBe(true)
    expect(sameName('Khách sạn Demo Hà Nội'.normalize('NFD'), 'Khách sạn Demo Hà Nội')).toBe(true)
  })

  it('refuses a name without its accents, a part of it, or nothing', () => {
    expect(sameName('Khach san Demo Ha Noi', 'Khách sạn Demo Hà Nội')).toBe(false)
    expect(sameName('Khách sạn Demo', 'Khách sạn Demo Hà Nội')).toBe(false)
    expect(sameName('', 'Khách sạn')).toBe(false)
    expect(sameName(undefined, 'Khách sạn')).toBe(false)
    expect(sameName('   ', '   ')).toBe(false)
  })

  it('starts today at midnight in Vietnam', () => {
    // 23:30 on the 26th UTC is 06:30 on the 27th in Vietnam.
    expect(vietnamDayStart(new Date('2026-10-26T23:30:00Z')).toISOString()).toBe('2026-10-26T17:00:00.000Z')
    expect(vietnamDayStart(new Date('2026-10-26T16:59:00Z')).toISOString()).toBe('2026-10-25T17:00:00.000Z')
  })

  it('blocks on guests checked in, and pending or confirmed stays that end today or later', () => {
    const now = new Date('2026-10-27T05:00:00Z')
    expect(guestsBookedWhere(now)).toEqual({
      OR: [
        { status: 'CHECKED_IN' },
        { status: { in: ['PENDING', 'CONFIRMED'] }, checkOutDate: { gte: new Date('2026-10-26T17:00:00.000Z') } },
      ],
    })
  })
})
