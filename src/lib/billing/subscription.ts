/**
 * A workspace's Digistay plan in the database (src/lib/billing/period.ts has
 * the rules). Every workspace has one row: made with the workspace (trial),
 * or here on first read for a workspace that has none yet (made by an older
 * release, between the migration and the deploy).
 */
import type { Prisma, PrismaClient, Subscription } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isPlanId, planById, type Plan, type PlanId } from '@/lib/marketing/plans'
import { TRIAL_PLAN, subscriptionState, trialEndFrom, type SubscriptionState } from './period'

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

/** The plan in force and its state now. A locked workspace keeps its plan's limits for reading. */
export async function workspacePlan(workspaceId: string, db: Db = prisma, now = new Date()): Promise<WorkspacePlan> {
  const subscription = await ensureSubscription(workspaceId, db, now)
  const planId = isPlanId(subscription.plan) ? subscription.plan : TRIAL_PLAN
  return { subscription, planId, plan: planById(planId), ...subscriptionState(subscription, now) }
}
