import { NextRequest, NextResponse } from 'next/server'
import { runEinvoiceJobs } from '@/lib/einvoice/jobs'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/einvoice-jobs — auto-issue, uncertain publishes and
 * invoice emails (src/lib/einvoice/jobs.ts), every 10 minutes from
 * docker/systemd/digistay-reconcile.service. Needs the CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await runEinvoiceJobs()
  console.log(`[einvoice] jobs ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
