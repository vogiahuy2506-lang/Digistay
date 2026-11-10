import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { confirmPlatformWebhook, platformPayosConfigured, platformWebhookUrl } from '@/lib/billing/platform-payos'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/system/confirm-webhook — Register and confirm the Digistay platform PayOS webhook.
 * Accessible only by platform SUPER_ADMIN.
 */
export async function POST() {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  if (!platformPayosConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Chưa cài PayOS của Digistay (DIGISTAY_PAYOS_*)' },
      { status: 400 }
    )
  }

  try {
    const data = await confirmPlatformWebhook()
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        webhookUrl: platformWebhookUrl(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không xác nhận được webhook với PayOS',
      },
      { status: 500 }
    )
  }
}
