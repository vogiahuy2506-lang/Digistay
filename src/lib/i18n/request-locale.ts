import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/locales'

/**
 * The language of the page that sent this request, for the emails it
 * triggers (a sign-up code, an invitation...): the visitor's choice in the
 * NEXT_LOCALE cookie (src/i18n/locales.ts), Vietnamese without one.
 */
export function requestLocale(request: { cookies: { get(name: string): { value: string } | undefined } }): Locale {
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value
  return isLocale(chosen) ? chosen : DEFAULT_LOCALE
}
