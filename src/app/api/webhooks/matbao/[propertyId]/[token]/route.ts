import { NextRequest, NextResponse } from 'next/server'
import { handleMatbaoWebhook } from '@/lib/einvoice/matbao-webhook'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit } from '@/lib/security/rate-limit'

/**
 * POST /api/webhooks/matbao/[propertyId]/[token] — tax-office status of an
 * issued invoice, from Mắt Bão. Public: the per-property secret token in
 * the URL is the credential (Mắt Bão does not sign callbacks); see
 * src/lib/einvoice/matbao-webhook.ts.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ propertyId: string; token: string }> }) {
  const { propertyId, token } = await props.params
  const limited = await hit(LIMITS.einvoiceWebhookIp, getClientIp(request.headers))
  if (!limited.allowed) return NextResponse.json({ success: false }, { status: 429 })

  const body = await request.json().catch(() => null)
  try {
    const { status } = await handleMatbaoWebhook(propertyId, token, body)
    return NextResponse.json({ success: status === 200 }, { status })
  } catch (error) {
    console.error('[einvoice] webhook failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
