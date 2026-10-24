/**
 * Absolute URLs of a hotel's pages on its canonical origin
 * (canonicalSiteOrigin, src/lib/public-site/site-host.ts), in both
 * languages: Vietnamese at the root, English under /en (src/middleware.ts).
 * One place, so canonical links, hreflang, the sitemap and structured data
 * name a page the same way.
 */
import type { Locale } from '@/i18n/locales'

/** origin + a path inside the site ("/", "/rooms/x") in a language. */
export function sitePageUrl(origin: string, locale: Locale, path = '/'): string {
  const rest = path === '/' || path === '' ? '' : path.startsWith('/') ? path : `/${path}`
  if (locale === 'en') return `${origin}/en${rest}`
  return `${origin}${rest || '/'}`
}

/** The page in each language, Vietnamese as the default (hreflang x-default). */
export function sitePageLanguages(origin: string, path = '/'): Record<'vi' | 'en' | 'x-default', string> {
  const vi = sitePageUrl(origin, 'vi', path)
  return { vi, en: sitePageUrl(origin, 'en', path), 'x-default': vi }
}

/** A room type's page inside the site. */
export const roomPath = (roomId: string) => `/rooms/${encodeURIComponent(roomId)}`

/**
 * An image URL fit for Open Graph and structured data: absolute http(s)
 * only. Uploads stored as data: URLs, or paths that only make sense on one
 * host, are left out rather than sent to crawlers broken.
 */
export function absoluteImageUrl(url: string | null | undefined): string | null {
  const value = url?.trim()
  return value && /^https?:\/\/[^\s]+$/i.test(value) ? value : null
}
