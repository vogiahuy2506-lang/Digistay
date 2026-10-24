'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { siteHref } from '@/lib/public-site/paths'
import type { Locale } from '@/i18n/locales'
import type { ThemePreference } from '@/lib/theme'
import { ThemeToggle } from '@/components/marketing/ThemeToggle'

/**
 * The site's base path in each language (src/lib/public-site/paths.ts; the
 * English one ends in /en), set by [subdomain]/layout.tsx.
 */
interface SiteBase {
  locale: Locale
  bases: Record<Locale, string>
  /** The current page in the other language (worked out by the layout). */
  switchHref: string
  /** The visitor's light / dark choice when the page was rendered. */
  theme: ThemePreference
}

const SiteBaseContext = React.createContext<SiteBase | null>(null)

export function SiteBaseProvider({ locale, bases, switchHref, theme, children }: SiteBase & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ locale, bases, switchHref, theme }), [locale, bases, switchHref, theme])
  return <SiteBaseContext.Provider value={value}>{children}</SiteBaseContext.Provider>
}

function useSiteBase(): SiteBase {
  const site = React.useContext(SiteBaseContext)
  if (site === null) throw new Error('used outside SiteBaseProvider')
  return site
}

/** Builds links inside the hotel's site, in the current language: href('/rooms/x'), href('/search?…'). */
export function useSiteHref() {
  const { locale, bases } = useSiteBase()
  const base = bases[locale]
  return React.useCallback((path: string) => siteHref(base, path), [base])
}

/** An <a> to a page of the hotel's site, for server components. */
export function SiteLink({
  path,
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { path: string }) {
  const href = useSiteHref()
  return <a href={href(path)} {...props} />
}

/** The same page in the other language ("EN" / "VI"), dates and filters kept. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, switchHref } = useSiteBase()
  const t = useTranslations('site.language')
  const other: Locale = locale === 'en' ? 'vi' : 'en'
  return (
    <a href={switchHref} hrefLang={other} lang={other} aria-label={t('switchLabel')} className={className}>
      {t('switchShort')}
    </a>
  )
}

/** Light / dark for the visitor (the same cookie as Digistay's pages and the dashboard). */
export function SiteThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const { theme } = useSiteBase()
  const t = useTranslations('site.nav')
  return <ThemeToggle initial={theme} toDark={t('toDark')} toLight={t('toLight')} className={className} withLabel={withLabel} />
}
