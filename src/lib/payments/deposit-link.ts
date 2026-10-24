/**
 * The link a guest uses to pay their deposit later (/<subdomain>/dat-coc/<token>),
 * from the booking email or after leaving PayOS without paying.
 *
 * Stateless: the booking id and an HMAC of it, with a key derived from
 * NEXTAUTH_SECRET for this purpose only (like the two-factor ticket and the
 * custom-domain proof). Not guessable, so it only ever opens the guest's own
 * booking. No expiry in the token: the booking decides (still PENDING, the
 * hotel's deadline not passed). It shows the booking code, dates and amount,
 * nothing about the guest.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'crypto'
import type { Locale } from '@/i18n/locales'
import { appSiteUrl } from '@/lib/public-site/paths'

const SIGNATURE_BYTES = 16

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return Buffer.from(hkdfSync('sha256', secret, '', 'digistay deposit link v1', 32))
}

function sign(bookingId: string): Buffer {
  return createHmac('sha256', key()).update(bookingId).digest().subarray(0, SIGNATURE_BYTES)
}

export function depositToken(bookingId: string): string {
  return `${bookingId}.${sign(bookingId).toString('base64url')}`
}

/** The booking id, or null when the token is forged or malformed. */
export function readDepositToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 200) return null
  const [bookingId, signature, ...rest] = token.split('.')
  if (!bookingId || !signature || rest.length > 0 || !/^[A-Za-z0-9_-]+$/.test(bookingId)) return null
  const given = Buffer.from(signature, 'base64url')
  const expected = sign(bookingId)
  return given.length === expected.length && timingSafeEqual(given, expected) ? bookingId : null
}

/** The full link, on the app's host (works whatever domain the hotel's site uses), in the booking's language. */
export function depositUrl(subdomain: string, bookingId: string, locale: Locale = 'vi'): string {
  return appSiteUrl(process.env.NEXTAUTH_URL, subdomain, locale, `/dat-coc/${depositToken(bookingId)}`)
}
