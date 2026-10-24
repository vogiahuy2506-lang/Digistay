import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { publicTheme } from '@/components/marketing/PublicFrame'
import { SITE_BASE_HEADER, SITE_PATH_HEADER, siteBasePath, siteHref } from '@/lib/public-site/paths'
import { hotelAccentVariables, hotelButtonVariables, hotelHeadingVariables } from '@/lib/public-site/accent'
import { fontStack } from '@/lib/public-site/font-stack'
import { loadSiteFrame, siteSeoTexts } from '@/lib/public-site/site-frame'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { OG_LOCALES } from '@/lib/seo/page-metadata'
import { SiteBaseProvider } from './_components/site-base'
import { siteFontVariables } from './fonts'

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params
  // An unpublished site is a 404: its title must not give the hotel away.
  const visible = await loadVisibleSite(subdomain)
  if (!visible) return {}
  const site = await loadSiteFrame(subdomain)
  if (!site) return {}
  // Hotel pages used to carry Digistay's own title ("DigiStay - Nền Tảng No-Code...").
  const lang = (await getLocale()) === 'en' ? 'en' : 'vi'
  const { title, description } = siteSeoTexts(site, lang)
  return {
    // The home page keeps the hotel's own title; other pages read "<page> · <hotel>".
    title: { default: title, template: `%s · ${site.name}` },
    description,
    // For pages without their own (the booking steps): the hotel's, never Digistay's.
    // The home and room pages set theirs with the canonical URL (src/lib/seo/page-metadata.ts).
    openGraph: { type: 'website', siteName: site.name, title, description, locale: OG_LOCALES[lang] },
    // A preview is for the hotel's own staff (visibility.ts) and never indexed.
    ...(visible.preview ? { robots: { index: false, follow: false } } : {}),
  }
}

/**
 * Every page of a hotel's site. Works out once whether links need the
 * "/<subdomain>" prefix, and sets the site's look: the visitor's light / dark
 * choice (the ds-theme cookie, as on Digistay's pages; SiteHeader's toggle
 * flips data-theme here), near-square corners (data-surface="site"), the
 * hotel's accent for both themes and its fonts.
 */
export default async function HotelSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const requestHeaders = await headers()
  const host = requestHeaders.get('host')
  const settings = (await loadSiteFrame(subdomain))?.websiteSettings
  const preview = (await loadVisibleSite(subdomain))?.preview ?? false
  const locale = await getLocale()
  const theme = await publicTheme()
  const t = await getTranslations('site')
  // Links keep the language: /<hotel>/en/... (or /en/... on the hotel's own host).
  // From the middleware; the Host header is the fallback (src/lib/public-site/paths.ts).
  const base = requestHeaders.get(SITE_BASE_HEADER) ?? siteBasePath(subdomain, host)
  const bases = { vi: base, en: `${base}/en` }
  // The same page in the other language, worked out here: client hooks
  // (usePathname) see the rewritten path on the server and the visitor's on
  // the client, and the two renders must match.
  const page = requestHeaders.get(SITE_PATH_HEADER) ?? '/'
  const q = page.indexOf('?')
  const otherLocale = locale === 'en' ? 'vi' : 'en'
  const switchHref = siteHref(bases[otherLocale], q < 0 ? page : page.slice(0, q)) + (q < 0 ? '' : page.slice(q))

  const style = {
    ...hotelAccentVariables(settings?.primaryColor),
    ...hotelButtonVariables(settings?.buttonColor),
    ...hotelHeadingVariables(settings?.headingColor),
    '--site-body': fontStack(settings?.fontFamily, 'body'),
    '--site-heading': fontStack(settings?.headingFont, 'heading'),
    // Older blocks and the search page still read these (raw hotel colors).
    '--brand-primary': settings?.primaryColor ?? '#A93119',
    '--brand-font-body': 'var(--site-body)',
    '--brand-font-heading': 'var(--site-heading)',
  } as React.CSSProperties

  return (
    <div
      data-public-theme
      data-theme={theme}
      data-surface="site"
      data-site-heading={settings?.headingColor ? '' : undefined}
      className={`${siteFontVariables} min-h-screen bg-page text-fg font-site-body antialiased dark:[color-scheme:dark]`}
      style={style}
    >
      {preview && <p className="bg-ink px-4 py-2 text-center text-small text-on-ink">{t('preview')}</p>}
      <SiteBaseProvider locale={locale} bases={bases} switchHref={switchHref} theme={theme}>
        {children}
      </SiteBaseProvider>
    </div>
  )
}
