import { NextRequest, NextResponse } from 'next/server'
import { handlePayosWebhook } from '@/lib/payments/payos'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit } from '@/lib/security/rate-limit'

/**
 * POST /api/webhooks/payos/[propertyId] — PayOS payment notifications for
 * one property (Part 5). Public: the signature, checked with that
 * property's checksum key, is the credential; see src/lib/payments/payos.ts.
 * Answers fast: PayOS resends when it waits too long.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await props.params
  const limited = await hit(LIMITS.payosWebhookIp, getClientIp(request.headers))
  if (!limited.allowed) {
    return NextResponse.json({ success: false }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } })
  }

  const body = await request.json().catch(() => null)
  try {
    const { status, outcome } = await handlePayosWebhook(propertyId, body)
    if (outcome === 'amount_mismatch') console.warn(`[payos] amount mismatch on property ${propertyId}`)
    return NextResponse.json({ success: status === 200 }, { status })
  } catch (error) {
    // Temporary failure (database...): 500 makes PayOS try again later.
    console.error('[payos] webhook failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
