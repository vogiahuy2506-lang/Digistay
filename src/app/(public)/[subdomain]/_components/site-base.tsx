'use client'

import * as React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { siteHref } from '@/lib/public-site/paths'
import type { Locale } from '@/i18n/locales'

/**
 * The site's base path in each language (src/lib/public-site/paths.ts; the
 * English one ends in /en), set by [subdomain]/layout.tsx.
 */
interface SiteBase {
  locale: Locale
  bases: Record<Locale, string>
  /** '/<hotel>': the path the pages are rendered under after the middleware's rewrite. */
  internal: string
}

const SiteBaseContext = React.createContext<SiteBase | null>(null)

export function SiteBaseProvider({ locale, bases, internal, children }: SiteBase & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ locale, bases, internal }), [locale, bases, internal])
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
  const { locale, bases, internal } = useSiteBase()
  const t = useTranslations('site.language')
  const pathname = usePathname() ?? '/'
  const query = useSearchParams()?.toString()
  const other: Locale = locale === 'en' ? 'vi' : 'en'
  // usePathname() may give the browser's path (/<hotel>/en/rooms/x, /en/rooms/x)
  // or the rewritten one (/<hotel>/rooms/x): strip whichever base it starts with.
  const prefixes = [bases[locale], `${internal}/en`, internal].filter(Boolean).sort((a, b) => b.length - a.length)
  const prefix = prefixes.find((p) => pathname === p || pathname.startsWith(`${p}/`))
  const rest = prefix ? pathname.slice(prefix.length) || '/' : pathname
  const href = siteHref(bases[other], rest) + (query ? `?${query}` : '')
  return (
    <a href={href} hrefLang={other} lang={other} aria-label={t('switchLabel')} className={className}>
      {t('switchShort')}
    </a>
  )
}
