import { NextResponse, type NextRequest } from 'next/server'
import { rootDomain, subdomainOf } from '@/lib/subdomains'

/**
 * Property sites on subdomains: foo.digistay.vn/rooms/x is served by
 * /foo/rooms/x (the public site under src/app/(public)/[subdomain]). Only
 * page requests are rewritten: the API keeps its own paths on every host.
 *
 * This file used to live at the repository root, where Next does not load
 * it with the src/ layout, so it never ran. Its other job, sending "/" to
 * /login or the first workspace, is dropped: "/" is the marketing page.
 */
export function middleware(request: NextRequest) {
  const sub = subdomainOf(request.headers.get('host') ?? '', rootDomain())
  if (!sub) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = `/${sub}${request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Not the API (webhooks need their own paths), build assets or root files.
  // Whole path segments only: a bare `api` prefix also skipped /api-hotel,
  // which then rendered property "api-hotel" on another hotel's subdomain.
  matcher: [
    '/((?!api(?:/|$)|_next/static/|_next/image(?:/|$)|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)',
  ],
}
