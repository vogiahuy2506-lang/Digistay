import { NextRequest, NextResponse } from 'next/server'
import { confirmPlatformWebhook, platformPayosConfigured, platformWebhookUrl } from '@/lib/billing/platform-payos'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * POST /api/internal/platform-payos/confirm-webhook — registers
 * /api/webhooks/payos/digistay with Digistay's PayOS account, once after the
 * DIGISTAY_PAYOS_* keys are set (RUNBOOK, "Bán gói"). CRON_SECRET header;
 * nginx does not route /api/internal/.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused
  if (!platformPayosConfigured()) {
    return NextResponse.json({ success: false, error: 'DIGISTAY_PAYOS_* not set' }, { status: 503 })
  }
  try {
    const account = await confirmPlatformWebhook()
    return NextResponse.json({ success: true, data: { webhookUrl: platformWebhookUrl(), accountName: account.accountName, accountNumber: account.accountNumber } })
  } catch (error) {
    const desc = (error as { desc?: string })?.desc ?? (error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: desc }, { status: 502 })
  }
}
