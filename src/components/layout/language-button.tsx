'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LOCALE_COOKIE, type Locale } from '@/i18n/locales'
import { cn } from '@/lib/utils'

/**
 * VI | EN for the signed-in pages: it shows the other language and switches
 * to it through the visitor's language cookie (src/i18n/request.ts).
 */
export function LanguageButton({ className }: { className?: string }) {
  const t = useTranslations('dash.common.shell')
  const locale = useLocale() as Locale
  const router = useRouter()
  const next: Locale = locale === 'en' ? 'vi' : 'en'

  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
        router.refresh()
      }}
      aria-label={t('language')}
      title={t('language')}
      className={cn(
        'w-9 h-9 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160',
        'text-[12px] font-semibold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
        className
      )}
    >
      {next}
    </button>
  )
}
