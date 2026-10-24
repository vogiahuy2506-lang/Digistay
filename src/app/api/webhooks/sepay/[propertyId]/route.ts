import { NextRequest, NextResponse } from 'next/server'
import { handleSepayIpn } from '@/lib/payments/sepay'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit } from '@/lib/security/rate-limit'

/**
 * POST /api/webhooks/sepay/[propertyId] — SePay's IPN for one property's
 * card payments (task 34). Public: the order is read back from SePay's API
 * with that property's keys before anything is recorded, and a wrong
 * X-Secret-Key is refused; see src/lib/payments/sepay.ts.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await props.params
  const limited = await hit(LIMITS.sepayWebhookIp, getClientIp(request.headers))
  if (!limited.allowed) {
    return NextResponse.json({ success: false }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } })
  }

  const body = await request.json().catch(() => null)
  try {
    const { status, outcome } = await handleSepayIpn(propertyId, request.headers.get('x-secret-key'), body)
    if (outcome === 'amount_mismatch') console.warn(`[sepay] amount mismatch on property ${propertyId}`)
    return NextResponse.json({ success: status === 200 }, { status })
  } catch (error) {
    // SePay or the database unreachable: 500, and reconcile catches it up.
    console.error('[sepay] IPN failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
