import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { reconcilePendingPayos } from '@/lib/payments/payos-reconcile'

/**
 * POST /api/internal/payos-reconcile — the scheduled PayOS reconcile, called
 * by docker/systemd/digistay-reconcile.service from inside the app
 * container. Needs the CRON_SECRET header; nginx does not route
 * /api/internal/ at all, so it is unreachable from outside the VPS.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ success: false, error: 'CRON_SECRET is not set' }, { status: 503 })

  const given = Buffer.from(request.headers.get('x-cron-secret') ?? '')
  const expected = Buffer.from(secret)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const summary = await reconcilePendingPayos()
  console.log(`[payos] reconcile ${JSON.stringify(summary)}`)
  return NextResponse.json({ success: true, data: summary })
}
