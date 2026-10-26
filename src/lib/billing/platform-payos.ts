/**
 * Digistay's own PayOS account, which receives plan payments (hotels' guest
 * payments go to each hotel's account: src/lib/payments/payos.ts). Keys in
 * the environment: DIGISTAY_PAYOS_CLIENT_ID / _API_KEY / _CHECKSUM_KEY (not
 * the SDK's own PAYOS_* names, which it would read for every client).
 *
 * The account's webhook is /api/webhooks/payos/digistay, registered once
 * with POST /api/internal/platform-payos/confirm-webhook (RUNBOOK). Use a
 * payment channel of its own: confirming this URL on a channel another app
 * uses would take that app's webhook away.
 */
import { PayOS } from '@payos/node'

/** Set, and not the template's placeholder (.env.production.template: PASTE_… / CHANGE_ME). */
export const realSetting = (value: string | undefined) => Boolean(value?.trim()) && !/^(PASTE_|CHANGE_ME)/.test(value!.trim())

export function platformPayosConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return realSetting(env.DIGISTAY_PAYOS_CLIENT_ID) && realSetting(env.DIGISTAY_PAYOS_API_KEY) && realSetting(env.DIGISTAY_PAYOS_CHECKSUM_KEY)
}

/** The client for Digistay's account; callers check platformPayosConfigured() first. */
export function platformPayos(): PayOS {
  return new PayOS({
    clientId: process.env.DIGISTAY_PAYOS_CLIENT_ID?.trim(),
    apiKey: process.env.DIGISTAY_PAYOS_API_KEY?.trim(),
    checksumKey: process.env.DIGISTAY_PAYOS_CHECKSUM_KEY?.trim(),
    timeout: 15_000,
    maxRetries: 1,
    logLevel: 'off',
  })
}

export function platformWebhookUrl(): string {
  return `${process.env.NEXTAUTH_URL}/api/webhooks/payos/digistay`
}

/** Registers the webhook URL with PayOS (which first calls it with a signed test). */
export async function confirmPlatformWebhook() {
  return platformPayos().webhooks.confirm(platformWebhookUrl())
}
