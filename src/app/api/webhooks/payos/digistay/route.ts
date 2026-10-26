import { NextRequest, NextResponse } from 'next/server'
import { handlePlatformWebhook } from '@/lib/billing/checkout'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit } from '@/lib/security/rate-limit'

/**
 * POST /api/webhooks/payos/digistay — PayOS notifications for Digistay's own
 * account: plan payments (src/lib/billing/checkout.ts). Public: the signature,
 * checked with Digistay's checksum key, is the credential. The static segment
 * wins over the hotels' /api/webhooks/payos/[propertyId].
 */
export async function POST(request: NextRequest) {
  const limited = await hit(LIMITS.payosWebhookIp, getClientIp(request.headers))
  if (!limited.allowed) {
    return NextResponse.json({ success: false }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } })
  }
  const body = await request.json().catch(() => null)
  try {
    const { status, outcome } = await handlePlatformWebhook(body)
    if (outcome === 'amount_mismatch') console.warn('[billing] PayOS amount mismatch on a plan payment')
    return NextResponse.json({ success: status === 200 }, { status })
  } catch (error) {
    // Temporary failure (database...): 500 makes PayOS try again later.
    console.error('[billing] webhook failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
