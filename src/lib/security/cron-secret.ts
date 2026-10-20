import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Scheduled jobs under /api/internal/ need the x-cron-secret header. nginx
 * does not route /api/internal/ at all; the systemd timers call them from
 * inside the app container. Returns the refusal, or null when allowed.
 */
export function checkCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ success: false, error: 'CRON_SECRET is not set' }, { status: 503 })

  const given = Buffer.from(request.headers.get('x-cron-secret') ?? '')
  const expected = Buffer.from(secret)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ success: false }, { status: 401 })
  }
  return null
}
