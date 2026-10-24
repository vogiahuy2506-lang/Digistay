/**
 * robots.txt and sitemap.xml, as pure functions of what the host is
 * (src/app/robots.ts and src/app/sitemap.ts read the Host header and the
 * database, then call these).
 *
 * - Digistay's host: the marketing pages are open; the app behind a login is
 *   not for crawlers. The sitemap lists the marketing pages that are indexed
 *   (terms and privacy are drafts with noindex, see their pages).
 * - A hotel's host, published and active: everything but the API; the
 *   sitemap lists the home page and each room type's page in both languages.
 * - Any other host (an unpublished or unknown hotel, a reserved name, an IP):
 *   nothing is crawled and the sitemap is empty.
 */
import type { MetadataRoute } from 'next'
import { roomPath, sitePageLanguages, sitePageUrl } from './urls'

/** Digistay's indexed pages: home, pricing, contact (src/app/(marketing)). */
export const DIGISTAY_SITEMAP_PATHS = ['/', '/pricing', '/contact'] as const

/**
 * Top-level routes behind a login. Each is blocked as the page itself
 * ("$" ends the match) and everything under it, not as a bare prefix: a
 * hotel at digistay.vn/profile-hotel must stay open.
 */
const DIGISTAY_PRIVATE_ROUTES = ['workspace', 'workspaces', 'workspace-picker', 'profile', 'admin', 'invitations'] as const

export function digistayRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...DIGISTAY_PRIVATE_ROUTES.flatMap((r) => [`/${r}$`, `/${r}/`])],
    },
    sitemap: `${origin}/sitemap.xml`,
  }
}

export function digistaySitemap(origin: string): MetadataRoute.Sitemap {
  return DIGISTAY_SITEMAP_PATHS.map((path) => ({
    url: path === '/' ? `${origin}/` : `${origin}${path}`,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.8,
  }))
}

/** What robots.txt and the sitemap need of a published, active hotel. */
export interface HotelSeoSite {
  /** canonicalSiteOrigin() */
  origin: string
  /** The latest change to the hotel or its site settings. */
  updatedAt: Date
  /** Active room types, in the order the site lists them. */
  rooms: { id: string; updatedAt: Date }[]
}

/** null: the host names no hotel a visitor may see (unpublished, inactive, unknown). */
export function hotelRobots(site: HotelSeoSite | null): MetadataRoute.Robots {
  if (!site) return closedRobots()
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${site.origin}/sitemap.xml`,
  }
}

/** Nothing to crawl on this host. */
export function closedRobots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}

export function hotelSitemap(site: HotelSeoSite | null): MetadataRoute.Sitemap {
  if (!site) return []
  const latest = (dates: Date[]) => new Date(Math.max(...dates.map((d) => d.getTime())))
  // The home page shows every room type, so a room's change is the home's too.
  const homeModified = latest([site.updatedAt, ...site.rooms.map((r) => r.updatedAt)])
  const pages = [
    { path: '/', lastModified: homeModified, priority: 1 },
    ...site.rooms.map((r) => ({ path: roomPath(r.id), lastModified: r.updatedAt, priority: 0.8 })),
  ]
  return pages.flatMap(({ path, lastModified, priority }) => {
    const languages = sitePageLanguages(site.origin, path)
    return (['vi', 'en'] as const).map((locale) => ({
      url: sitePageUrl(site.origin, locale, path),
      lastModified,
      changeFrequency: 'weekly' as const,
      priority,
      alternates: { languages },
    }))
  })
}
