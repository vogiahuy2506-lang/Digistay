/**
 * The arithmetic of Digistay plans, without the database: prices, period
 * ends and what state a subscription is in. Decisions (2026-10-26): a new
 * workspace gets a 14-day trial of Growth; every payment starts a new period
 * from the day it is paid (nothing carries over); past the end there are 7
 * days of grace, then the workspace is read-only until it pays.
 */
import type { BillingPeriod } from '@prisma/client'
import { YEARLY_MONTHS, planById, type PlanId } from '@/lib/marketing/plans'

export const TRIAL_PLAN: PlanId = 'growth'
export const TRIAL_DAYS = 14
export const GRACE_DAYS = 7
/** Reminders before the end, in days. */
export const REMIND_BEFORE_DAYS = [7, 1] as const

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

/** The reminder due now for this period, if any and not sent yet (keys: soon7, soon1, ended, locked). */
export function dueReminder(
  sub: { trial: boolean; periodEnd: Date; reminders: unknown },
  now = new Date(),
): 'soon7' | 'soon1' | 'ended' | 'locked' | null {
  const sent = (sub.reminders && typeof sub.reminders === 'object' ? sub.reminders : {}) as Record<string, unknown>
  const { state, daysLeft } = subscriptionState(sub, now)
  if (state === 'locked') return sent.locked ? null : 'locked'
  if (state === 'grace') return sent.ended ? null : 'ended'
  // Only the closest one: a trial that starts with 14 days gets "7 days" once, then "1 day".
  if (daysLeft <= 1) return sent.soon1 ? null : 'soon1'
  if (daysLeft <= 7) return sent.soon7 || sent.soon1 ? null : 'soon7'
  return null
}
