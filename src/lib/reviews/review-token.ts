import { createHmac, hkdfSync, timingSafeEqual } from 'crypto'
import type { Locale } from '@/i18n/locales'
import { appSiteUrl } from '@/lib/public-site/paths'

const SIGNATURE_BYTES = 16

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return Buffer.from(hkdfSync('sha256', secret, '', 'digistay review link v1', 32))
}

function sign(bookingId: string): Buffer {
  return createHmac('sha256', key()).update(bookingId).digest().subarray(0, SIGNATURE_BYTES)
}

/**
 * Sinh reviewToken không thể đoán được gắn liền với bookingId.
 */
export function generateReviewToken(bookingId: string): string {
  return `${bookingId}.${sign(bookingId).toString('base64url')}`
}

/**
 * Đọc bookingId từ reviewToken. Trả về null nếu token bị giả mạo hoặc không hợp lệ.
 */
export function readReviewToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 200) return null
  const [bookingId, signature, ...rest] = token.split('.')
  if (!bookingId || !signature || rest.length > 0 || !/^[A-Za-z0-9_-]+$/.test(bookingId)) return null
  const given = Buffer.from(signature, 'base64url')
  const expected = sign(bookingId)
  return given.length === expected.length && timingSafeEqual(given, expected) ? bookingId : null
}

/**
 * Đường dẫn đánh giá gửi cho khách qua email: `/[subdomain]/danh-gia?token=[token]`.
 */
export function reviewUrl(subdomain: string, bookingId: string, locale: Locale = 'vi'): string {
  const path = `/danh-gia?token=${generateReviewToken(bookingId)}`
  return appSiteUrl(process.env.NEXTAUTH_URL, subdomain, locale, path)
}
