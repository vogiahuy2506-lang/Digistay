import { NextResponse, type NextRequest } from 'next/server'
import { isAllowedSubdomain, rootDomain, subdomainOf } from '@/lib/subdomains'
import { isCustomDomainCandidate, siteForHost } from '@/lib/public-site/custom-host'
import { SITE_BASE_HEADER, SITE_PATH_HEADER } from '@/lib/public-site/paths'
import { DEFAULT_LOCALE, SITE_LOCALE_HEADER, isLocale, type Locale } from '@/i18n/locales'

/**
 * Property sites on subdomains: foo.digistay.vn/rooms/x is served by
 * /foo/rooms/x (the public site under src/app/(public)/[subdomain]). Only
 * page requests are rewritten: the API keeps its own paths on every host.
 *
 * A hotel's site is in English under /en: foo.digistay.vn/en/rooms/x and
 * digistay.vn/foo/en/rooms/x are /foo/rooms/x with SITE_LOCALE_HEADER "en"
 * (src/i18n/locales.ts). Every other hotel-site request gets "vi", so the
 * site never follows the dashboard's language cookie.
 *
 * A hotel's own domain (www.khachsan.vn), once verified, serves its site the
 * same way as its subdomain (src/lib/public-site/custom-host.ts).
 *
 * This file used to live at the repository root, where Next does not load
 * it with the src/ layout, so it never ran. Its other job, sending "/" to
 * /login or the first workspace, is dropped: "/" is the marketing page.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const host = request.headers.get('host') ?? ''
  const root = rootDomain()
  const sub = subdomainOf(host, root)

  if (sub) {
    const { locale, rest } = splitLocale(path)
    return toSite(request, `/${sub}${rest === '/' ? '' : rest}`, locale, '', rest)
  }

  // A hotel's own domain: its site, with no prefix (like its subdomain).
  const hostname = host.split(':')[0].toLowerCase()
  if (isCustomDomainCandidate(hostname, root)) {
    const site = await siteForHost(hostname)
    if (site) {
      const { locale, rest } = splitLocale(path)
      return toSite(request, `/${site}${rest === '/' ? '' : rest}`, locale, '', rest)
    }
  }

  // digistay.vn/<hotel>/... is the same site as <hotel>.digistay.vn/...
  const [, first, ...more] = path.split('/')
  if (first && isAllowedSubdomain(first)) {
    const { locale, rest } = splitLocale(`/${more.join('/')}`)
    return toSite(request, `/${first}${rest === '/' ? '' : rest}`, locale, `/${first}`, rest)
  }

  // Not a hotel site: the language comes from the visitor's cookie; site
  // headers sent by the client are not ours.
  if ([SITE_LOCALE_HEADER, SITE_BASE_HEADER, SITE_PATH_HEADER].some((h) => request.headers.has(h))) {
    const headers = new Headers(request.headers)
    headers.delete(SITE_LOCALE_HEADER)
    headers.delete(SITE_BASE_HEADER)
    headers.delete(SITE_PATH_HEADER)
    return NextResponse.next({ request: { headers } })
  }
  return NextResponse.next()
}

/** '/en/rooms/x' → English, '/rooms/x'; anything else is Vietnamese, unchanged. */
function splitLocale(path: string): { locale: Locale; rest: string } {
  if (path === '/en' || path.startsWith('/en/')) return { locale: 'en', rest: path.slice(3) || '/' }
  return { locale: DEFAULT_LOCALE, rest: path }
}

function toSite(request: NextRequest, pathname: string, locale: Locale, base: string, rest: string) {
  const headers = new Headers(request.headers)
  // `next start` runs the middleware a second time on the rewritten path
  // (/<hotel>/..., without /en, as an internal request on the app's host),
  // carrying the headers the first run set: keep them, or every English
  // page turned Vietnamese and subdomain links got the /<hotel> prefix.
  // A client sending them itself only changes its own page's language or links.
  const kept = request.headers.get(SITE_LOCALE_HEADER)
  headers.set(SITE_LOCALE_HEADER, locale === DEFAULT_LOCALE && isLocale(kept) ? kept : locale)
  const keptBase = request.headers.get(SITE_BASE_HEADER)
  headers.set(SITE_BASE_HEADER, keptBase !== null && (keptBase === '' || keptBase === base) ? keptBase : base)
  // The page within the site, as the visitor asked for it (the first run's stays).
  if (!request.headers.has(SITE_PATH_HEADER)) headers.set(SITE_PATH_HEADER, `${rest}${request.nextUrl.search}`)
  if (pathname === request.nextUrl.pathname) return NextResponse.next({ request: { headers } })
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.rewrite(url, { request: { headers } })
}

export const config = {
  // Not the API (webhooks need their own paths), build assets or root files.
  // Whole path segments only: a bare `api` prefix also skipped /api-hotel,
  // which then rendered property "api-hotel" on another hotel's subdomain.
  matcher: [
    '/((?!api(?:/|$)|_next/static/|_next/image(?:/|$)|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)',
  ],
}
