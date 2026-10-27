/**
 * Telling the owner before the plan's limits stop them (the plan jobs,
 * /api/internal/subscription-jobs): when the workspace reaches 80% and then
 * 100% of a limit, once each, in the bell (notifyPlanOwner, plan_usage).
 * E-invoices count per month and running out stops invoicing guests, so
 * those are emailed too, once a month per level.
 *
 * What was told is kept in Subscription.usageAlerts; going back under a
 * level forgets it, so reaching it again tells again. Small limits stay
 * quiet where a warning would only nag: no 80% under a limit of 5 (80% of 3
 * is 100% anyway), no 100% for a single property (Starter has one).
 * A read-only workspace (locked) is told about its plan instead.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendAfterResponse } from '@/lib/email/outbox'
import { planById } from '@/lib/marketing/plans'
import { notifyPlanOwner } from '@/lib/notifications'
import { subscriptionState } from './period'
import { vietnamMonth, workspaceUsage, type LimitKind } from './limits'
import { queueUsageAlert } from './emails'

export type UsageLevel = 0 | 80 | 100

const KINDS: LimitKind[] = ['properties', 'rooms', 'staff', 'invoices']

/** The level reached: 100 at the limit, 80 from 80% of it, else 0 (see the file's comment for small limits). */
export function usageLevel(used: number, limit: number): UsageLevel {
  if (limit <= 0) return 0
  if (used >= limit) return limit > 1 ? 100 : 0
  return limit >= 5 && used >= limit * 0.8 ? 80 : 0
}

type Told = Partial<Record<Exclude<LimitKind, 'invoices'>, UsageLevel>> & { invoices?: { month: string; level: UsageLevel } }

/** "2026-10": the e-invoice month, Vietnam time. */
const monthKey = (now: Date) => new Date(vietnamMonth(now).start.getTime() + 7 * 3600_000).toISOString().slice(0, 7)

/**
 * What to tell for one workspace now, and what is then known as told. Pure,
 * for the job and its tests.
 */
export function usageNotices(
  told: Told,
  usage: Record<LimitKind, number>,
  limits: Record<LimitKind, number>,
  month: string,
): { notices: { kind: LimitKind; level: Exclude<UsageLevel, 0> }[]; told: Told } {
  const next: Told = {}
  const notices: { kind: LimitKind; level: Exclude<UsageLevel, 0> }[] = []
  for (const kind of KINDS) {
    const level = usageLevel(usage[kind], limits[kind])
    if (kind === 'invoices') {
      const before = told.invoices?.month === month ? told.invoices.level : 0
      if (level > before) notices.push({ kind, level: level as 80 | 100 })
      if (level > 0) next.invoices = { month, level: Math.max(level, before) as UsageLevel }
      continue
    }
    const before = told[kind] ?? 0
    if (level > before) notices.push({ kind, level: level as 80 | 100 })
    // Under a level again: forget it, so reaching it later tells again.
    if (level > 0) next[kind] = level
  }
  return { notices, told: next }
}

export async function runUsageAlerts(now = new Date()) {
  const month = monthKey(now)
  // Subscriptions are not hidden with a deleted workspace (src/lib/db/soft-delete.ts): skip those here.
  const subs = await prisma.subscription.findMany({
    where: { workspace: { deletedAt: null } },
    select: { workspaceId: true, plan: true, trial: true, periodEnd: true, usageAlerts: true, updatedAt: true },
  })
  let notified = 0
  for (const sub of subs) {
    if (subscriptionState(sub, now).state === 'locked') continue
    const plan = planById(sub.plan)
    const usage = await workspaceUsage(sub.workspaceId, prisma, now)
    const told = (sub.usageAlerts ?? {}) as Told
    const { notices, told: next } = usageNotices(told, usage, plan, month)
    if (!notices.length && JSON.stringify(next) === JSON.stringify(told)) continue
    const emailIds = await prisma.$transaction(async (tx) => {
      // Claim it first, so two runs at once tell once.
      const claimed = await tx.subscription.updateMany({
        where: { workspaceId: sub.workspaceId, updatedAt: sub.updatedAt },
        data: { usageAlerts: next as Prisma.InputJsonObject },
      })
      if (claimed.count === 0) return []
      const ids: string[] = []
      for (const { kind, level } of notices) {
        const facts = { kind, level, used: usage[kind], limit: plan[kind], plan: plan.id }
        await notifyPlanOwner(tx, sub.workspaceId, 'plan_usage', facts)
        if (kind === 'invoices') ids.push(await queueUsageAlert(sub.workspaceId, facts, tx))
      }
      notified += notices.length
      return ids
    })
    if (emailIds.length) sendAfterResponse(emailIds)
  }
  return { checked: subs.length, notified }
}
