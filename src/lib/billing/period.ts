/**
 * The arithmetic of Digistay plans, without the database: prices, period
 * ends, what state a subscription is in and what a purchase does to it.
 * Decisions (2026-10-26): a new workspace gets a 14-day trial of Growth;
 * past the end there are 7 days of grace, then the workspace is read-only
 * until it pays. Changing plans works like Founder AI's (planChange): no
 * proration; an upgrade starts now and drops what is left; a downgrade is
 * paid now and starts when the current period ends; renewing the same plan
 * is possible in the last days (RENEW_WINDOW_DAYS) and chained to the end,
 * so nothing is lost.
 */
import type { BillingPeriod } from '@prisma/client'
import { YEARLY_MONTHS, planById, type PlanId } from '@/lib/marketing/plans'

export const TRIAL_PLAN: PlanId = 'growth'
export const TRIAL_DAYS = 14
export const GRACE_DAYS = 7
/** Reminders before the end, in days (30 for yearly plans only). */
export const REMIND_BEFORE_DAYS = [30, 7, 1] as const
/** Renewing the same plan is open this many days before the end; the first reminder says so. */
export const RENEW_WINDOW_DAYS: Record<BillingPeriod, number> = { MONTH: 7, YEAR: 30 }
/** A yearly plan cannot move to a monthly one while this many days or more are left. */
export const YEAR_TO_MONTH_MIN_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** VND for one period of a plan, before VAT. */
export function priceFor(plan: PlanId, billing: BillingPeriod): number {
  const monthly = planById(plan).price
  return billing === 'YEAR' ? monthly * YEARLY_MONTHS : monthly
}

/**
 * `months` calendar months after `from`, the day clamped to the target
 * month's last day (31 Jan + 1 month = 28/29 Feb), the time of day kept.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}

export function periodEndFrom(start: Date, billing: BillingPeriod): Date {
  return addMonths(start, billing === 'YEAR' ? 12 : 1)
}

export function trialEndFrom(start: Date): Date {
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS)
}

export type SubscriptionStateName = 'trial' | 'active' | 'grace' | 'locked'

/**
 * The trial's welcome (src/components/billing/trial-welcome.tsx): to the
 * owner, once, while the free trial runs.
 */
export function welcomesTrial(sub: { trial: boolean; trialWelcomedAt: Date | null }, state: SubscriptionStateName, isOwner: boolean): boolean {
  return isOwner && sub.trial && state === 'trial' && !sub.trialWelcomedAt
}

export interface SubscriptionState {
  state: SubscriptionStateName
  /** Whole days until periodEnd (trial / active), rounded up; 0 once past it. */
  daysLeft: number
  /** When the grace ends and the workspace locks. */
  locksAt: Date
  /** Whole days of grace left (grace only), rounded up. */
  graceDaysLeft: number
}

export function subscriptionState(sub: { trial: boolean; periodEnd: Date }, now = new Date()): SubscriptionState {
  const end = sub.periodEnd.getTime()
  const locksAt = new Date(end + GRACE_DAYS * DAY_MS)
  const t = now.getTime()
  if (t < end) {
    return { state: sub.trial ? 'trial' : 'active', daysLeft: Math.ceil((end - t) / DAY_MS), locksAt, graceDaysLeft: GRACE_DAYS }
  }
  if (t < locksAt.getTime()) {
    return { state: 'grace', daysLeft: 0, locksAt, graceDaysLeft: Math.ceil((locksAt.getTime() - t) / DAY_MS) }
  }
  return { state: 'locked', daysLeft: 0, locksAt, graceDaysLeft: 0 }
}

/**
 * The reminder due now for this period, if any and not sent yet (keys:
 * soon30 for yearly plans, soon7, soon1, ended, locked). None while a paid
 * downgrade waits: the workspace goes on with it.
 */
export function dueReminder(
  sub: { trial: boolean; billing?: BillingPeriod | null; periodEnd: Date; reminders: unknown; nextPlan?: string | null },
  now = new Date(),
): 'soon30' | 'soon7' | 'soon1' | 'ended' | 'locked' | null {
  if (sub.nextPlan) return null
  const sent = (sub.reminders && typeof sub.reminders === 'object' ? sub.reminders : {}) as Record<string, unknown>
  const { state, daysLeft } = subscriptionState(sub, now)
  if (state === 'locked') return sent.locked ? null : 'locked'
  if (state === 'grace') return sent.ended ? null : 'ended'
  // Only the closest one: a trial that starts with 14 days gets "7 days" once, then "1 day".
  if (daysLeft <= 1) return sent.soon1 ? null : 'soon1'
  if (daysLeft <= 7) return sent.soon7 || sent.soon1 ? null : 'soon7'
  if (daysLeft <= 30 && !sub.trial && sub.billing === 'YEAR') return sent.soon30 || sent.soon7 || sent.soon1 ? null : 'soon30'
  return null
}

export type ChangeKind = 'new' | 'renew' | 'upgrade' | 'downgrade'
export type ChangeBlock = 'RENEW_TOO_EARLY' | 'YEARLY_TO_MONTHLY' | 'CHANGE_SCHEDULED'

export interface PlanChange {
  kind: ChangeKind
  /** When the paid period starts: now, or the current end (renew, downgrade) */
  startsAt: Date
  endsAt: Date
  /** Days of the current period or trial given up (upgrade; a purchase during the trial) */
  lostDays: number
  /** Why the purchase is refused now (checkout); a payment that arrives anyway is still applied */
  blocked: ChangeBlock | null
  /** RENEW_TOO_EARLY: the first day renewing is open */
  renewFrom: Date | null
}

/**
 * What buying `target` does to the subscription now (Founder AI's rules,
 * with renewals chained instead of refused):
 *
 * - ended (grace, locked) or on the trial: a new period from now; the
 *   trial's days left are given up.
 * - the same plan in the renewal window (either billing): chained to the end.
 *   Earlier: refused (RENEW_TOO_EARLY) for the same billing.
 * - monthly → yearly, or a dearer plan: an upgrade, from now, the days left
 *   given up.
 * - yearly → monthly: refused with YEAR_TO_MONTH_MIN_DAYS or more left; in
 *   the last days, an upgrade if the monthly price is higher, else a downgrade.
 * - a cheaper plan: a downgrade, paid now, starting at the end; one at a time.
 */
export function planChange(
  sub: { plan: string; billing: BillingPeriod | null; trial: boolean; periodEnd: Date; nextPlan?: string | null; nextPeriodEnd?: Date | null },
  target: { plan: PlanId; billing: BillingPeriod },
  now = new Date(),
): PlanChange {
  const t = now.getTime()
  const end = sub.periodEnd.getTime()
  const fromNow = (lostDays: number): PlanChange => ({
    kind: 'upgrade',
    startsAt: now,
    endsAt: periodEndFrom(now, target.billing),
    lostDays,
    blocked: null,
    renewFrom: null,
  })
  if (t >= end) return { ...fromNow(0), kind: 'new' }
  const daysLeft = Math.ceil((end - t) / DAY_MS)
  if (sub.trial) return { ...fromNow(daysLeft), kind: 'new' }

  const billing = sub.billing ?? 'MONTH'
  // A downgrade already waiting: what comes after this period is that one.
  const after = (from: Date): PlanChange => ({
    kind: 'downgrade',
    startsAt: from,
    endsAt: periodEndFrom(from, target.billing),
    lostDays: 0,
    blocked: sub.nextPlan ? 'CHANGE_SCHEDULED' : null,
    renewFrom: null,
  })

  if (target.plan === sub.plan) {
    const window = RENEW_WINDOW_DAYS[billing]
    if (daysLeft <= window) {
      return { kind: 'renew', startsAt: sub.periodEnd, endsAt: periodEndFrom(sub.periodEnd, target.billing), lostDays: 0, blocked: null, renewFrom: null }
    }
    if (target.billing === billing) {
      return {
        kind: 'renew',
        startsAt: sub.periodEnd,
        endsAt: periodEndFrom(sub.periodEnd, target.billing),
        lostDays: 0,
        blocked: 'RENEW_TOO_EARLY',
        renewFrom: new Date(end - window * DAY_MS),
      }
    }
  }

  const dearer = planById(target.plan).price > planById(sub.plan).price
  if (billing === 'MONTH' && target.billing === 'YEAR') return fromNow(daysLeft)
  if (billing === 'YEAR' && target.billing === 'MONTH') {
    if (daysLeft >= YEAR_TO_MONTH_MIN_DAYS) return { ...after(sub.periodEnd), blocked: 'YEARLY_TO_MONTHLY' }
    return dearer ? fromNow(daysLeft) : after(sub.periodEnd)
  }
  return dearer ? fromNow(daysLeft) : after(sub.periodEnd)
}
