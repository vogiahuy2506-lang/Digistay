/**
 * The canonical link, language alternates and Open Graph / Twitter tags of
 * a page, for generateMetadata. Every URL is absolute: the hotel's pages
 * answer on several hosts (site-host.ts), so nothing may resolve against
 * the request's.
 *
 * Next merges metadata one top-level key at a time (a page's `openGraph`
 * replaces its layout's whole), so each page builds all of it here.
 */
import type { Metadata } from 'next'
import type { Locale } from '@/i18n/locales'
import { absoluteImageUrl, sitePageLanguages, sitePageUrl } from './urls'

export const OG_LOCALES: Record<Locale, string> = { vi: 'vi_VN', en: 'en_US' }

type PageMeta = Pick<Metadata, 'alternates' | 'openGraph' | 'twitter'>

export interface HotelPageMetaInput {
  /** canonicalSiteOrigin() */
  origin: string
  locale: Locale
  /** The page inside the site: "/", "/rooms/x". */
  path: string
  /** The hotel's name. */
  siteName: string
  title: string
  description?: string | null
  /** Tried in order; the first absolute http(s) one is used. */
  images: (string | null | undefined)[]
}

/** A page of a hotel's site, on its canonical origin, in both languages. */
export function hotelPageMetadata(input: HotelPageMetaInput): PageMeta {
  const url = sitePageUrl(input.origin, input.locale, input.path)
  const image = input.images.map(absoluteImageUrl).find(Boolean)
  return {
    alternates: { canonical: url, languages: sitePageLanguages(input.origin, input.path) },
    openGraph: {
      type: 'website',
      url,
      siteName: input.siteName,
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      locale: OG_LOCALES[input.locale],
      alternateLocale: OG_LOCALES[input.locale === 'en' ? 'vi' : 'en'],
      ...(image ? { images: [{ url: image, alt: input.title }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary' },
  }
}

/** Digistay's share image (public/), until a dedicated one is designed. */
export const DIGISTAY_OG_IMAGE = { path: '/logo_full_digistay.png', width: 800, height: 447 } as const

export interface DigistayPageMetaInput {
  /** appOrigin() */
  origin: string
  /** The language the page is shown in (a cookie, not the URL: no hreflang). */
  locale: Locale
  path: string
  title: string
  description?: string | null
}

/** One of Digistay's own pages (src/app/(marketing)). */
export function digistayPageMetadata(input: DigistayPageMetaInput): PageMeta {
  const url = input.path === '/' ? `${input.origin}/` : `${input.origin}${input.path}`
  return {
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Digistay',
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      locale: OG_LOCALES[input.locale],
      images: [{ url: `${input.origin}${DIGISTAY_OG_IMAGE.path}`, width: DIGISTAY_OG_IMAGE.width, height: DIGISTAY_OG_IMAGE.height, alt: 'Digistay' }],
    },
    twitter: { card: 'summary_large_image' },
  }
}
