import { NextRequest, NextResponse } from 'next/server'
import { syncAllActiveIcalFeeds } from '@/lib/ota/ical-sync'
import { checkCronSecret } from '@/lib/security/cron-secret'
import { recordJobRun } from '@/lib/ops/job-runs'

/**
 * POST /api/internal/ical-sync — scheduled background sync for all active iCal
 * feeds across properties (Airbnb, Booking.com, Agoda Homes, etc.).
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await recordJobRun('ical-sync', () => syncAllActiveIcalFeeds())
  console.log(`[ical-sync] job summary: ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
