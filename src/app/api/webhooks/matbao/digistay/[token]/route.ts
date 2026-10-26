import { NextRequest, NextResponse } from 'next/server'
import { handlePlatformMatbaoWebhook } from '@/lib/billing/einvoice'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit } from '@/lib/security/rate-limit'

/**
 * POST /api/webhooks/matbao/digistay/[token] — tax-office status of a plan
 * payment's e-invoice, from Digistay's own Mắt Bão account. Public: the
 * secret in the URL (DIGISTAY_MATBAO_WEBHOOK_SECRET) is the credential; see
 * src/lib/billing/einvoice.ts. Hotels' accounts call
 * /api/webhooks/matbao/[propertyId]/[token].
 */
export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const limited = await hit(LIMITS.einvoiceWebhookIp, getClientIp(request.headers))
  if (!limited.allowed) return NextResponse.json({ success: false }, { status: 429 })

  const body = await request.json().catch(() => null)
  try {
    const { status } = await handlePlatformMatbaoWebhook(token, body)
    return NextResponse.json({ success: status === 200 }, { status })
  } catch (error) {
    console.error('[billing] platform e-invoice webhook failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
