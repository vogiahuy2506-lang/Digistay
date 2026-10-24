import { NextRequest, NextResponse } from 'next/server'
import { reconcilePendingPayos } from '@/lib/payments/payos-reconcile'
import { reconcilePendingSepay } from '@/lib/payments/sepay'
import { expireUnpaidDeposits } from '@/lib/payments/guest-deposit'
import { checkCronSecret } from '@/lib/security/cron-secret'
import { recordJobRun } from '@/lib/ops/job-runs'

/**
 * POST /api/internal/payos-reconcile — the scheduled PayOS reconcile, called
 * by docker/systemd/digistay-reconcile.service from inside the app
 * container. Needs the CRON_SECRET header; nginx does not route
 * /api/internal/ at all, so it is unreachable from outside the VPS.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  // SePay card payments whose IPN never came (sepay.ts), then guest
  // deposits past the hotel's deadline (guest-deposit.ts), after reconcile
  // has applied any payment PayOS or SePay knows about.
  const summary = await recordJobRun('payos-reconcile', async () => ({
    ...(await reconcilePendingPayos()),
    sepay: await reconcilePendingSepay(),
    deposits: await expireUnpaidDeposits(),
  }))
  console.log(`[payos] reconcile ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
