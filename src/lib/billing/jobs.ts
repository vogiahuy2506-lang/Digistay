/**
 * The plan reminders (/api/internal/subscription-jobs, every 10 minutes with
 * the other jobs): 7 days and 1 day before the end, when it ends, and when
 * the workspace locks — each once per period (Subscription.reminders,
 * cleared when a payment starts a new period).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendAfterResponse } from '@/lib/email/outbox'
import { GRACE_DAYS, dueReminder } from './period'
import { queueSubscriptionReminder } from './emails'

export async function runSubscriptionReminders(now = new Date()) {
  // Ending within 7 days, or ended up to a day after the lock: the only ones with something due.
  const from = new Date(now.getTime() - (GRACE_DAYS + 1) * 86_400_000)
  const to = new Date(now.getTime() + 7 * 86_400_000)
  const subs = await prisma.subscription.findMany({ where: { periodEnd: { gte: from, lte: to } }, take: 500 })
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
  return { checked: subs.length, sent }
}
