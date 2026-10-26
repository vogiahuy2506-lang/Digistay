import { describe, expect, it } from 'vitest'
import { addMonths, dueReminder, periodEndFrom, priceFor, subscriptionState, trialEndFrom } from './period'

const at = (iso: string) => new Date(iso)
const DAY = 86_400_000

describe('priceFor', () => {
  it('is the monthly price, or ten months for a year', () => {
    expect(priceFor('starter', 'MONTH')).toBe(2_000)
    expect(priceFor('growth', 'YEAR')).toBe(50_000)
  })
})

describe('periods', () => {
  it('adds calendar months, clamping the day to the month', () => {
    expect(addMonths(at('2026-01-31T03:00:00Z'), 1).toISOString()).toBe('2026-02-28T03:00:00.000Z')
    expect(addMonths(at('2028-01-31T03:00:00Z'), 1).toISOString()).toBe('2028-02-29T03:00:00.000Z')
    expect(addMonths(at('2026-10-26T08:15:00Z'), 12).toISOString()).toBe('2027-10-26T08:15:00.000Z')
  })

  it('ends a month or a year after the payment, and a trial 14 days after it starts', () => {
    expect(periodEndFrom(at('2026-10-26T00:00:00Z'), 'MONTH').toISOString()).toBe('2026-11-26T00:00:00.000Z')
    expect(periodEndFrom(at('2026-10-26T00:00:00Z'), 'YEAR').toISOString()).toBe('2027-10-26T00:00:00.000Z')
    expect(trialEndFrom(at('2026-10-26T00:00:00Z')).toISOString()).toBe('2026-11-09T00:00:00.000Z')
  })
})

describe('subscriptionState', () => {
  const end = at('2026-11-09T00:00:00Z')

  it('counts the days left of a trial or a paid period', () => {
    expect(subscriptionState({ trial: true, periodEnd: end }, new Date(end.getTime() - 3.5 * DAY))).toMatchObject({ state: 'trial', daysLeft: 4 })
    expect(subscriptionState({ trial: false, periodEnd: end }, new Date(end.getTime() - DAY))).toMatchObject({ state: 'active', daysLeft: 1 })
  })

  it('gives 7 days of grace after the end, then locks', () => {
    expect(subscriptionState({ trial: false, periodEnd: end }, end)).toMatchObject({ state: 'grace', graceDaysLeft: 7 })
    expect(subscriptionState({ trial: true, periodEnd: end }, new Date(end.getTime() + 6.2 * DAY))).toMatchObject({ state: 'grace', graceDaysLeft: 1 })
    expect(subscriptionState({ trial: false, periodEnd: end }, new Date(end.getTime() + 7 * DAY)).state).toBe('locked')
  })
})

describe('dueReminder', () => {
  const end = at('2026-11-09T00:00:00Z')
  const sub = (reminders: object | null = null) => ({ trial: false, periodEnd: end, reminders })

  it('sends nothing more than a week ahead', () => {
    expect(dueReminder(sub(), new Date(end.getTime() - 10 * DAY))).toBeNull()
  })

  it('sends the 7-day one, then the 1-day one, each once', () => {
    expect(dueReminder(sub(), new Date(end.getTime() - 6 * DAY))).toBe('soon7')
    expect(dueReminder(sub({ soon7: 'x' }), new Date(end.getTime() - 6 * DAY))).toBeNull()
    expect(dueReminder(sub({ soon7: 'x' }), new Date(end.getTime() - 0.5 * DAY))).toBe('soon1')
    expect(dueReminder(sub({ soon7: 'x', soon1: 'x' }), new Date(end.getTime() - 0.5 * DAY))).toBeNull()
  })

  it('skips the 7-day one when the 1-day one is already due', () => {
    expect(dueReminder(sub(), new Date(end.getTime() - 0.5 * DAY))).toBe('soon1')
  })

  it('tells when it ended and when it locked', () => {
    expect(dueReminder(sub({ soon1: 'x' }), new Date(end.getTime() + DAY))).toBe('ended')
    expect(dueReminder(sub({ ended: 'x' }), new Date(end.getTime() + 8 * DAY))).toBe('locked')
    expect(dueReminder(sub({ ended: 'x', locked: 'x' }), new Date(end.getTime() + 8 * DAY))).toBeNull()
  })
})
