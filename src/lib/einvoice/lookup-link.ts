/**
 * The public link to an issued invoice (task 39): /<subdomain>/hoa-don/<token>
 * on the hotel's site, where the buyer sees the invoice and downloads its PDF
 * without an account. It goes out in the invoice email, and staff copy it
 * from the invoice ("Sao chép link tra cứu").
 *
 * Stateless, like the deposit link (src/lib/payments/deposit-link.ts): the
 * invoice id and an HMAC of it, with a key derived from NEXTAUTH_SECRET for
 * this purpose only. MaTraCuu ("DS" + invoice number) is printed on the
 * invoice and easy to guess, so it is never the key to the page.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'crypto'
import type { Locale } from '@/i18n/locales'
import { appSiteUrl } from '@/lib/public-site/paths'

const SIGNATURE_BYTES = 16

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return Buffer.from(hkdfSync('sha256', secret, '', 'digistay invoice lookup v1', 32))
}

function sign(invoiceId: string): Buffer {
  return createHmac('sha256', key()).update(invoiceId).digest().subarray(0, SIGNATURE_BYTES)
}

export function invoiceLookupToken(invoiceId: string): string {
  return `${invoiceId}.${sign(invoiceId).toString('base64url')}`
}

/** The invoice id, or null when the token is forged or malformed. */
export function readInvoiceLookupToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 200) return null
  const [invoiceId, signature, ...rest] = token.split('.')
  if (!invoiceId || !signature || rest.length > 0 || !/^[A-Za-z0-9_-]+$/.test(invoiceId)) return null
  const given = Buffer.from(signature, 'base64url')
  const expected = sign(invoiceId)
  return given.length === expected.length && timingSafeEqual(given, expected) ? invoiceId : null
}

/** The full link, on the app's host (works whatever domain the hotel's site uses), in the buyer's language. */
export function invoiceLookupUrl(subdomain: string, invoiceId: string, locale: Locale = 'vi'): string {
  return appSiteUrl(process.env.NEXTAUTH_URL, subdomain, locale, `/hoa-don/${invoiceLookupToken(invoiceId)}`)
}

/**
 * The PDF behind the page's "Tải PDF" (src/app/api/public/invoices/[token]/pdf),
 * with the page's language for the way back when Mắt Bão cannot serve it.
 */
export function invoicePdfPath(token: string, locale: Locale = 'vi'): string {
  return `/api/public/invoices/${encodeURIComponent(token)}/pdf${locale === 'en' ? '?lang=en' : ''}`
}
