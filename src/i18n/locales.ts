/**
 * The app's languages. Vietnamese is the default and has no URL prefix.
 *
 * Where the language comes from:
 * - a hotel's site: its URL (/en/... is English), so a link always opens in
 *   the language it was shared in; src/middleware.ts strips the prefix and
 *   passes the language in SITE_LOCALE_HEADER;
 * - every other page (dashboard, sign-in, marketing): the visitor's choice,
 *   kept in LOCALE_COOKIE.
 * Edge-safe: imported by the middleware.
 */
export const LOCALES = ['vi', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'vi'
export const LOCALE_COOKIE = 'NEXT_LOCALE'
export const SITE_LOCALE_HEADER = 'x-site-locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
