import { describe, expect, it } from 'vitest'
import { addMonths, dueReminder, periodEndFrom, planChange, priceFor, subscriptionState, trialEndFrom } from './period'

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

describe('dueReminder for yearly plans and scheduled switches', () => {
  const end = at('2026-11-09T00:00:00Z')

  it('adds a 30-day reminder for yearly plans only', () => {
    const yearly = { trial: false, billing: 'YEAR' as const, periodEnd: end, reminders: null }
    expect(dueReminder(yearly, new Date(end.getTime() - 25 * DAY))).toBe('soon30')
    expect(dueReminder({ ...yearly, reminders: { soon30: 'x' } }, new Date(end.getTime() - 25 * DAY))).toBeNull()
    expect(dueReminder({ ...yearly, reminders: { soon30: 'x' } }, new Date(end.getTime() - 5 * DAY))).toBe('soon7')
    expect(dueReminder({ ...yearly, billing: 'MONTH' }, new Date(end.getTime() - 25 * DAY))).toBeNull()
  })

  it('sends nothing while a paid downgrade waits to start', () => {
    expect(dueReminder({ trial: false, periodEnd: end, reminders: null, nextPlan: 'starter' }, new Date(end.getTime() - 2 * DAY))).toBeNull()
  })
})

describe('planChange (Founder AI rules, renewals chained)', () => {
  const now = at('2026-10-27T03:00:00Z')
  const sub = (o: Partial<{ plan: string; billing: 'MONTH' | 'YEAR' | null; trial: boolean; daysLeft: number; nextPlan: string | null }> = {}) => ({
    plan: o.plan ?? 'growth',
    billing: o.billing === undefined ? ('MONTH' as const) : o.billing,
    trial: o.trial ?? false,
    periodEnd: new Date(now.getTime() + (o.daysLeft ?? 20) * DAY),
    nextPlan: o.nextPlan ?? null,
  })

  it('starts a new period now once the plan has ended', () => {
    const c = planChange(sub({ daysLeft: -3 }), { plan: 'growth', billing: 'MONTH' }, now)
    expect(c).toMatchObject({ kind: 'new', lostDays: 0, blocked: null })
    expect(c.startsAt).toEqual(now)
    expect(c.endsAt).toEqual(periodEndFrom(now, 'MONTH'))
  })

  it('gives up the trial days left when buying during the trial', () => {
    expect(planChange(sub({ trial: true, billing: null, daysLeft: 9 }), { plan: 'starter', billing: 'MONTH' }, now)).toMatchObject({ kind: 'new', lostDays: 9 })
  })

  it('chains a renewal in the last days to the end, and refuses it earlier', () => {
    const late = sub({ daysLeft: 5 })
    const renew = planChange(late, { plan: 'growth', billing: 'MONTH' }, now)
    expect(renew).toMatchObject({ kind: 'renew', blocked: null, lostDays: 0 })
    expect(renew.startsAt).toEqual(late.periodEnd)
    expect(renew.endsAt).toEqual(periodEndFrom(late.periodEnd, 'MONTH'))

    const early = planChange(sub({ daysLeft: 20 }), { plan: 'growth', billing: 'MONTH' }, now)
    expect(early).toMatchObject({ kind: 'renew', blocked: 'RENEW_TOO_EARLY' })
    expect(early.renewFrom).toEqual(new Date(now.getTime() + 13 * DAY))
  })

  it('opens renewing a yearly plan 30 days ahead, to either billing', () => {
    expect(planChange(sub({ billing: 'YEAR', daysLeft: 25 }), { plan: 'growth', billing: 'YEAR' }, now)).toMatchObject({ kind: 'renew', blocked: null })
    expect(planChange(sub({ billing: 'YEAR', daysLeft: 25 }), { plan: 'growth', billing: 'MONTH' }, now)).toMatchObject({ kind: 'renew', blocked: null })
    expect(planChange(sub({ billing: 'YEAR', daysLeft: 40 }), { plan: 'growth', billing: 'YEAR' }, now)).toMatchObject({ blocked: 'RENEW_TOO_EARLY' })
  })

  it('upgrades at once to a dearer plan or from monthly to yearly, giving up the days left', () => {
    const dearer = planChange(sub({ daysLeft: 12 }), { plan: 'business', billing: 'MONTH' }, now)
    expect(dearer).toMatchObject({ kind: 'upgrade', lostDays: 12, blocked: null })
    expect(dearer.startsAt).toEqual(now)
    // Monthly → yearly is an upgrade even to a cheaper plan (Founder AI does the same).
    expect(planChange(sub({ daysLeft: 12 }), { plan: 'starter', billing: 'YEAR' }, now)).toMatchObject({ kind: 'upgrade', lostDays: 12 })
    // Same plan, monthly → yearly before the renewal window: an upgrade too.
    expect(planChange(sub({ daysLeft: 12 }), { plan: 'growth', billing: 'YEAR' }, now)).toMatchObject({ kind: 'upgrade' })
  })

  it('schedules a cheaper plan for the end, one at a time', () => {
    const s = sub({ plan: 'business', daysLeft: 12 })
    const down = planChange(s, { plan: 'starter', billing: 'MONTH' }, now)
    expect(down).toMatchObject({ kind: 'downgrade', blocked: null, lostDays: 0 })
    expect(down.startsAt).toEqual(s.periodEnd)
    expect(planChange({ ...s, nextPlan: 'growth' }, { plan: 'starter', billing: 'MONTH' }, now)).toMatchObject({ kind: 'downgrade', blocked: 'CHANGE_SCHEDULED' })
  })

  it('refuses yearly → monthly with 30 days or more left; later it compares monthly prices', () => {
    expect(planChange(sub({ billing: 'YEAR', daysLeft: 200 }), { plan: 'business', billing: 'MONTH' }, now)).toMatchObject({ blocked: 'YEARLY_TO_MONTHLY' })
    expect(planChange(sub({ billing: 'YEAR', daysLeft: 20 }), { plan: 'business', billing: 'MONTH' }, now)).toMatchObject({ kind: 'upgrade', blocked: null })
    expect(planChange(sub({ billing: 'YEAR', daysLeft: 20 }), { plan: 'starter', billing: 'MONTH' }, now)).toMatchObject({ kind: 'downgrade', blocked: null })
  })
})
