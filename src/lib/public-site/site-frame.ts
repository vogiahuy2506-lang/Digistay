import { cache, type CSSProperties } from 'react'
import type { Locale } from '@/i18n/locales'
import { prisma } from '@/lib/db'
import { localized, localizeRow } from '@/lib/i18n/content'
import { hotelAccentVariables, hotelButtonVariables, hotelHeadingVariables } from './accent'
import { fontStack } from './font-stack'
import { SITE_DOMAIN_SELECT } from './site-host'

/**
 * What the frame of every hotel page needs (the layout, its metadata) and
 * where the site is known (canonicalSiteOrigin), once per request: the
 * layout and the pages' generateMetadata share it. Not cached across
 * requests, like loadVisibleSite: a deactivated hotel goes at once.
 */
export const loadSiteFrame = cache((subdomain: string) =>
  prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: {
      name: true,
      description: true,
      translations: true,
      // The site's header and footer, for its 404 ([subdomain]/not-found.tsx).
      type: true,
      city: true,
      phone: true,
      address: true,
      websiteBlocks: { where: { isEnabled: true }, select: { type: true } },
      websiteSettings: {
        select: {
          primaryColor: true,
          buttonColor: true,
          headingColor: true,
          fontFamily: true,
          headingFont: true,
          metaTitle: true,
          metaDescription: true,
          translations: true,
          ...SITE_DOMAIN_SELECT,
        },
      },
    },
  })
)

export type SiteFrame = NonNullable<Awaited<ReturnType<typeof loadSiteFrame>>>

/**
 * The site's title and description in a language: the hotel's SEO texts from
 * the website builder, else its name and description (English ones when it
 * wrote them, src/lib/i18n/content.ts).
 */
export function siteSeoTexts(site: SiteFrame, locale: Locale): { title: string; description: string | undefined } {
  const seo = site.websiteSettings && localizeRow(site.websiteSettings, ['metaTitle', 'metaDescription'], locale)
  return {
    title: seo?.metaTitle || site.name,
    description: seo?.metaDescription || localized(site, 'description', locale) || undefined,
  }
}

/** The website settings that set a hotel page's look. */
export interface SiteLook {
  primaryColor?: string | null
  buttonColor?: string | null
  headingColor?: string | null
  fontFamily?: string | null
  headingFont?: string | null
}

/**
 * The CSS variables of a hotel page's root ([subdomain]/layout.tsx): its
 * accent, button and heading colors for both themes, and its fonts. A version
 * preview sets them again from the version ([subdomain]/phien-ban).
 */
export function siteFrameStyle(settings: SiteLook | null | undefined): CSSProperties {
  return {
    ...hotelAccentVariables(settings?.primaryColor),
    ...hotelButtonVariables(settings?.buttonColor),
    ...hotelHeadingVariables(settings?.headingColor),
    '--site-body': fontStack(settings?.fontFamily, 'body'),
    '--site-heading': fontStack(settings?.headingFont, 'heading'),
    // Older blocks and the search page still read these (raw hotel colors).
    '--brand-primary': settings?.primaryColor ?? '#A93119',
    '--brand-font-body': 'var(--site-body)',
    '--brand-font-heading': 'var(--site-heading)',
  } as CSSProperties
}
