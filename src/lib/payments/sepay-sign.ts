/**
 * The signature of SePay's checkout form (sepay.ts), on its own so the fake
 * SePay of the browser tests can check it without the app's database code.
 */
import { createHmac } from 'crypto'

/** The checkout fields SePay signs (its SDKs' list); others (custom_data) are sent unsigned. */
const SIGNED_FIELDS = new Set([
  'merchant', 'env', 'operation', 'payment_method', 'order_amount', 'currency', 'order_invoice_number',
  'order_description', 'customer_id', 'agreement_id', 'agreement_name', 'agreement_type',
  'agreement_payment_frequency', 'agreement_amount_per_payment', 'success_url', 'error_url', 'cancel_url',
])

/**
 * HMAC-SHA256 (base64) of "field=value" joined by ",", over the signed
 * fields in the order the form sends them, as SePay's Node and PHP SDKs do.
 */
export function signCheckoutFields(fields: [string, string][], secretKey: string): string {
  const signed = fields.filter(([name]) => SIGNED_FIELDS.has(name)).map(([name, value]) => `${name}=${value}`)
  return createHmac('sha256', secretKey).update(signed.join(',')).digest('base64')
}
