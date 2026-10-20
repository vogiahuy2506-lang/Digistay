import { NextRequest, NextResponse } from 'next/server'
import { reconcilePendingPayos } from '@/lib/payments/payos-reconcile'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/payos-reconcile — the scheduled PayOS reconcile, called
 * by docker/systemd/digistay-reconcile.service from inside the app
 * container. Needs the CRON_SECRET header; nginx does not route
 * /api/internal/ at all, so it is unreachable from outside the VPS.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await reconcilePendingPayos()
  console.log(`[payos] reconcile ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
