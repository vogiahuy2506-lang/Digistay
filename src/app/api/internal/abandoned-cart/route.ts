import { NextRequest, NextResponse } from 'next/server'
import { processAbandonedBookings } from '@/lib/bookings/abandoned-cart'
import { recordJobRun } from '@/lib/ops/job-runs'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/abandoned-cart
 * Scans pending bookings created between 2 and 12 hours ago with no successful payment,
 * marks abandonedEmailSentAt, and enqueues reminder emails into EmailOutbox.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await recordJobRun('abandoned-cart', () => processAbandonedBookings())
  console.log(`[abandoned-cart] job summary: ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
