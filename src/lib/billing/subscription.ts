/**
 * A workspace's Digistay plan in the database (src/lib/billing/period.ts has
 * the rules). Every workspace has one row: made with the workspace (trial),
 * or here on first read for a workspace that has none yet (made by an older
 * release, between the migration and the deploy).
 */
import { Prisma, type PrismaClient, type Subscription } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendAfterResponse } from '@/lib/email/outbox'
import { isPlanId, planById, type Plan, type PlanId } from '@/lib/marketing/plans'
import { TRIAL_PLAN, subscriptionState, trialEndFrom, type SubscriptionState } from './period'
import { queueSubscriptionSwitched } from './emails'

type Db = PrismaClient | Prisma.TransactionClient

/** A new workspace's trial, for `workspace.create({ data: { subscription: { create: trialFields() } } })`. */
export function trialFields(now = new Date()) {
  return { plan: TRIAL_PLAN, trial: true, periodStart: now, periodEnd: trialEndFrom(now) }
}

export async function ensureSubscription(workspaceId: string, db: Db = prisma, now = new Date()): Promise<Subscription> {
  const found = await db.subscription.findUnique({ where: { workspaceId } })
  if (found) return found
  // INSERT … ON CONFLICT DO NOTHING: parallel first reads (e.g. two requests
  // checking the lock at once) both find no row, and an upsert then fails on
  // the key for one of them.
  await db.subscription.createMany({
    data: { workspaceId, plan: TRIAL_PLAN, trial: true, periodStart: now, periodEnd: trialEndFrom(now) },
    skipDuplicates: true,
  })
  return db.subscription.findUniqueOrThrow({ where: { workspaceId } })
}

export interface WorkspacePlan extends SubscriptionState {
  subscription: Subscription
  planId: PlanId
  plan: Plan
}

/**
 * Starts the paid downgrade waiting for periodEnd once that has passed
 * (period.ts planChange). Done when the plan is read, so it switches on
 * time rather than at the next job; one conditional update, so concurrent
 * reads switch it once and the owner is emailed once.
 */
export async function startScheduledPlan(sub: Subscription, db: Db = prisma, now = new Date()): Promise<Subscription> {
  if (!sub.nextPlan || !sub.nextPeriodEnd || sub.periodEnd.getTime() > now.getTime()) return sub
  const switched = await db.subscription.updateMany({
    where: { workspaceId: sub.workspaceId, updatedAt: sub.updatedAt, nextPlan: sub.nextPlan },
    data: {
      plan: sub.nextPlan,
      billing: sub.nextBilling,
      trial: false,
      periodStart: sub.periodEnd,
      periodEnd: sub.nextPeriodEnd,
      reminders: Prisma.DbNull,
      nextPlan: null,
      nextBilling: null,
      nextPeriodEnd: null,
      nextPaymentId: null,
    },
  })
  if (switched.count === 1) {
    sendAfterResponse(await queueSubscriptionSwitched(sub.workspaceId, { plan: sub.nextPlan, from: sub.periodEnd, to: sub.nextPeriodEnd }, db))
  }
  return db.subscription.findUniqueOrThrow({ where: { workspaceId: sub.workspaceId } })
}

/** The plan in force and its state now. A locked workspace keeps its plan's limits for reading. */
export async function workspacePlan(workspaceId: string, db: Db = prisma, now = new Date()): Promise<WorkspacePlan> {
  const subscription = await startScheduledPlan(await ensureSubscription(workspaceId, db, now), db, now)
  const planId = isPlanId(subscription.plan) ? subscription.plan : TRIAL_PLAN
  return { subscription, planId, plan: planById(planId), ...subscriptionState(subscription, now) }
}
