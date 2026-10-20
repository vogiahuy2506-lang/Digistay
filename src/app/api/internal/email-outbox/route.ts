import { NextRequest, NextResponse } from 'next/server'
import { sendDueEmails } from '@/lib/email/outbox'
import { recordJobRun } from '@/lib/ops/job-runs'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/email-outbox — sends queued emails that are due
 * (src/lib/email/outbox.ts), every 10 minutes from
 * docker/systemd/scheduled-jobs.sh. Needs the CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await recordJobRun('email-outbox', () => sendDueEmails())
  console.log(`[email] outbox ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
