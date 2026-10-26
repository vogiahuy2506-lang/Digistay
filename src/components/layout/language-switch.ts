'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { LOCALE_COOKIE, type Locale } from '@/i18n/locales'

/**
 * Switches the signed-in pages between Vietnamese and English: the visitor's
 * language cookie (src/i18n/request.ts), then the page is read again, as
 * Digistay's public pages do (LocaleToggle). The account menus use it.
 */
export function useLanguageSwitch() {
  const locale = useLocale() as Locale
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const next: Locale = locale === 'en' ? 'vi' : 'en'

  const switchLanguage = React.useCallback(() => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }, [next, router])

  return { locale, next, pending, switchLanguage }
}
