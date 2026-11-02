/**
 * Marketing & Tracking validation and event helpers for Facebook Pixel and Google Tag (GA4/GTM).
 * Task 47: Gắn mã đo lường tiếp thị an toàn.
 */

/**
 * Validates a Facebook Pixel ID.
 * Meta Pixel IDs are pure digits, typically 9 to 20 digits long (usually 15-16 digits).
 */
export function isValidFacebookPixelId(id: string | null | undefined): boolean {
  if (!id) return false
  const trimmed = id.trim()
  return /^\d{9,20}$/.test(trimmed)
}

/**
 * Validates a Google Tag ID (Google Analytics 4, Google Tag Manager, Google Ads).
 * Valid formats include:
 * - GA4: G-XXXXXXXXXX (e.g. G-ABC1234567)
 * - Google Tag: GT-XXXXXXXXXX
 * - Google Tag Manager: GTM-XXXXXXX
 * - Google Ads: AW-XXXXXXXXX
 * - Legacy UA: UA-XXXXXXXX-X
 */
export function isValidGoogleTagId(id: string | null | undefined): boolean {
  if (!id) return false
  const trimmed = id.trim().toUpperCase()
  return /^(G|GT|GTM|AW|UA)-[A-Z0-9_-]{4,20}$/.test(trimmed)
}

/**
 * Sanitizes and cleans an input ID, returning null if invalid or empty.
 */
export function cleanFacebookPixelId(id: unknown): string | null {
  if (typeof id !== 'string') return null
  const trimmed = id.trim()
  return isValidFacebookPixelId(trimmed) ? trimmed : null
}

export function cleanGoogleTagId(id: unknown): string | null {
  if (typeof id !== 'string') return null
  const trimmed = id.trim().toUpperCase()
  return isValidGoogleTagId(trimmed) ? trimmed : null
}

export interface TrackingEventData {
  currency?: string
  value?: number
  content_name?: string
  content_type?: string
  content_ids?: string[]
  order_id?: string
  [key: string]: unknown
}
