/**
 * The plan reminders (/api/internal/subscription-jobs, every 10 minutes with
 * the other jobs): 30 days (yearly plans), 7 days and 1 day before the end,
 * when it ends, and when the workspace locks — each once per period
 * (Subscription.reminders, cleared when a payment starts a new period).
 * First, scheduled downgrades whose day has come start (reading the plan
 * does it too: subscription.ts startScheduledPlan).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendAfterResponse } from '@/lib/email/outbox'
import { GRACE_DAYS, dueReminder } from './period'
import { queueSubscriptionReminder } from './emails'
import { startScheduledPlan } from './subscription'

export async function runSubscriptionReminders(now = new Date()) {
  // Subscriptions are not hidden with a deleted workspace (src/lib/db/soft-delete.ts): skip those here.
  const live = { workspace: { deletedAt: null } }
  const due = await prisma.subscription.findMany({ where: { nextPlan: { not: null }, periodEnd: { lte: now }, ...live }, take: 500 })
  for (const sub of due) await startScheduledPlan(sub, prisma, now)

  // Ending within 30 days, or ended up to a day after the lock: the only ones with something due.
  const from = new Date(now.getTime() - (GRACE_DAYS + 1) * 86_400_000)
  const to = new Date(now.getTime() + 30 * 86_400_000)
  const subs = await prisma.subscription.findMany({ where: { periodEnd: { gte: from, lte: to }, ...live }, take: 500 })
  let sent = 0
  for (const sub of subs) {
    const kind = dueReminder(sub, now)
    if (!kind) continue
    const reminders = { ...((sub.reminders as Prisma.JsonObject | null) ?? {}), [kind]: now.toISOString() }
    const ids = await prisma.$transaction(async (tx) => {
      // Claim the reminder first, so two runs at once send it once.
      const claimed = await tx.subscription.updateMany({
        where: { workspaceId: sub.workspaceId, updatedAt: sub.updatedAt },
        data: { reminders },
      })
      if (claimed.count === 0) return []
      return queueSubscriptionReminder(sub.workspaceId, kind, sub, tx)
    })
    if (ids.length) {
      sent++
      sendAfterResponse(ids)
    }
  }
  return { started: due.length, checked: subs.length, sent }
}
