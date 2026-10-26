'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LocaleToggle } from '@/components/marketing/LocaleToggle'
import { LOCALE_COOKIE, type Locale } from '@/i18n/locales'
import { cn } from '@/lib/utils'

/**
 * VI | EN for the signed-in pages: the same switch as Digistay's public
 * pages (LocaleToggle), through the visitor's language cookie
 * (src/i18n/request.ts). `compact`: one button naming the other language,
 * for the sidebar's footer row, where the switch would push out the
 * user's name.
 */
export function LanguageButton({ compact }: { compact?: boolean | 'below-sm' }) {
  const t = useTranslations('dash.common.shell')
  const locale = useLocale() as Locale
  const router = useRouter()
  // 'below-sm': the one button on phones, the switch from sm up (top bars, where a phone has no room).
  if (compact === 'below-sm') {
    return (
      <>
        <span className="sm:hidden">
          <LanguageButton compact />
        </span>
        <span className="hidden sm:block">
          <LanguageButton />
        </span>
      </>
    )
  }
  if (!compact) return <LocaleToggle locale={locale} label={t('language')} />

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
      )}
    >
      {next}
    </button>
  )
}
