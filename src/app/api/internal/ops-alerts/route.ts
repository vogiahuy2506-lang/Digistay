import { NextRequest, NextResponse } from 'next/server'
import { evaluateAlerts } from '@/lib/ops/alerts'
import { pruneJobRuns, recordJobRun } from '@/lib/ops/job-runs'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/ops-alerts — checks the ops alert rules and emails the
 * people running Digistay (src/lib/ops/alerts.ts); also drops job history
 * older than 30 days. Last in docker/systemd/scheduled-jobs.sh, so it sees
 * the runs before it. Needs the CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await recordJobRun('ops-alerts', async () => ({ ...(await evaluateAlerts()), pruned: await pruneJobRuns() }))
  console.log(`[ops] alerts ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
