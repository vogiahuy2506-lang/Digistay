import { NextRequest, NextResponse } from 'next/server'
import { runSubscriptionReminders } from '@/lib/billing/jobs'
import { runOverageJobs } from '@/lib/billing/overage'
import { recordJobRun } from '@/lib/ops/job-runs'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/subscription-jobs — plan reminders (src/lib/billing/jobs.ts)
 * and what is over the plan (src/lib/billing/overage.ts: the grace, locking
 * the excess after it, unlocking what fits again), every 10 minutes with the
 * other jobs (docker/systemd/scheduled-jobs.sh).
 * CRON_SECRET header; nginx does not route /api/internal/.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused
  const summary = await recordJobRun('subscription-jobs', async () => ({
    reminders: await runSubscriptionReminders(),
    overage: await runOverageJobs(),
  }))
  return NextResponse.json({ success: true, data: summary })
}
