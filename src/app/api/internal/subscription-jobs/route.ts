import { NextRequest, NextResponse } from 'next/server'
import { runSubscriptionReminders } from '@/lib/billing/jobs'
import { runSubscriptionInvoiceJobs } from '@/lib/billing/einvoice'
import { recordJobRun } from '@/lib/ops/job-runs'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/subscription-jobs — plan reminders (src/lib/billing/jobs.ts)
 * and plan e-invoices still to issue or email (src/lib/billing/einvoice.ts),
 * every 10 minutes with the other jobs (docker/systemd/scheduled-jobs.sh).
 * CRON_SECRET header; nginx does not route /api/internal/.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused
  const summary = await recordJobRun('subscription-jobs', async () => ({
    reminders: await runSubscriptionReminders(),
    invoices: await runSubscriptionInvoiceJobs(),
  }))
  return NextResponse.json({ success: true, data: summary })
}
