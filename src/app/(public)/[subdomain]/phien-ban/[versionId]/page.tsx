import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { publicTheme } from '@/components/marketing/PublicFrame'
import { isLocale, type Locale } from '@/i18n/locales'
import { formatDateTime } from '@/lib/bookings/display'
import { amenityName } from '@/lib/i18n/amenities'
import { getPublicSiteProps, localizeSiteProps, siteBlocks } from '@/lib/public-site/site'
import { siteFrameStyle } from '@/lib/public-site/site-frame'
import { loadSiteVersionPreview } from '@/lib/public-site/versions'
import { routes } from '@/lib/utils/routes'
import { hexToChannels, themes } from '@/styles/tokens'
import { PropertySite } from '../../_components/PropertySite'

interface PageProps {
  params: Promise<{ subdomain: string; versionId: string }>
}

// Per request, for the signed-in staff only, and never indexed.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * A saved version of the hotel's home page (the builder's "Lịch sử phiên
 * bản" → "Xem"), read-only: rendered by the site's own PropertySite with the
 * version's blocks, colors and fonts over today's rooms, photos and prices.
 * Nothing is written; the live site is unchanged. Only the owner, ADMIN and
 * MANAGER of the hotel's workspace see it (src/lib/public-site/versions.ts);
 * anyone else, or another hotel's version, gets the site's 404.
 */
export default async function SiteVersionPreviewPage({ params }: PageProps) {
  const { subdomain, versionId } = await params
  const preview = await loadSiteVersionPreview(subdomain, versionId)
  if (!preview) notFound()
  const cached = await getPublicSiteProps(preview.propertyId)
  if (!cached) notFound()

  const current = await getLocale()
  const locale: Locale = isLocale(current) ? current : 'vi'
  const { snapshot, version } = preview
  const rows = snapshot.blocks.map((b, i) => ({ ...b, id: `version-${i}` }))
  const blocks = siteBlocks(rows, preview.propertyType).map((b) => ({
    id: b.id,
    type: b.type,
    name: b.name,
    config: b.config as Record<string, any>,
  }))
  const site = localizeSiteProps({ ...cached, blocks }, locale, (slug, name) => amenityName(slug, name, locale))
  const t = await getTranslations('site.versionPreview')

  // The page root ([subdomain]/layout.tsx) carries the live site's look; this
  // root sets the version's instead. A color the version did not pick must
  // not fall through to the live one: the button ink falls back to Digistay's
  // (`initial` leaves var() its fallback), headings to the text color.
  const style = {
    '--site-ink': 'initial',
    '--site-on-ink': 'initial',
    '--site-ink-dark': 'initial',
    '--site-on-ink-dark': 'initial',
    '--site-heading-color': hexToChannels(themes.light.fg),
    '--site-heading-color-dark': hexToChannels(themes.dark.fg),
    ...siteFrameStyle(snapshot.settings),
  } as React.CSSProperties

  return (
    // data-public-theme: the site's light / dark toggle flips this root too.
    <div
      data-public-theme
      data-theme={await publicTheme()}
      data-surface="site"
      data-site-heading={snapshot.settings.headingColor ? '' : undefined}
      className="bg-page font-site-body text-fg"
      style={style}
    >
      <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-line bg-warn-soft px-4 py-2.5 text-center text-small text-fg">
        <span>
          <strong className="font-semibold">{t('title', { time: formatDateTime(version.savedAt) })}</strong>
          {version.by && ` · ${t('by', { name: version.by })}`}
        </span>
        <span>{t('hint')}</span>
        <a href={routes.propertyWebsite(preview.workspaceSlug, preview.propertyId)} className="font-medium text-fg underline underline-offset-2">
          {t('back')}
        </a>
      </div>
      <PropertySite {...site} />
    </div>
  )
}
