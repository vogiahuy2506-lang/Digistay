import { cache } from 'react'
import type { Locale } from '@/i18n/locales'
import { prisma } from '@/lib/db'
import { localized, localizeRow } from '@/lib/i18n/content'
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
      websiteSettings: {
        select: {
          primaryColor: true,
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
