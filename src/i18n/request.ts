import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, SITE_LOCALE_HEADER, isLocale } from './locales'

/** The request's language (see locales.ts) and its messages (messages/<locale>.json). */
export default getRequestConfig(async () => {
  const site = (await headers()).get(SITE_LOCALE_HEADER)
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(site) ? site : isLocale(chosen) ? chosen : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Asia/Ho_Chi_Minh',
  }
})
