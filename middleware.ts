import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Main domain (the apex that users sign in on). All subdomains are
 * resolved as public property sites.
 *
 * In local dev this defaults to "localhost" — both `localhost:3000`
 * and path-based `/<subdomain>` routes work.
 */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost')
  .toLowerCase()
  .replace(/^https?:\/\//, '')

export async function middleware(request: NextRequest) {
  const { pathname, host } = request.nextUrl
  const hostname = (host ?? '').split(':')[0].toLowerCase()

  // ──────────────────────────────────────────────────────────────────
  // 1) Wildcard subdomain routing
  //    foo.digistay.vn        → /<foo>
  //    bar.localhost:3000     → /<bar>
  //    localhost:3000         → unchanged (workspace / login)
  // ──────────────────────────────────────────────────────────────────
  const isSubdomainRequest =
    hostname !== ROOT_DOMAIN &&
    hostname !== `www.${ROOT_DOMAIN}` &&
    hostname.endsWith(`.${ROOT_DOMAIN}`)

  if (isSubdomainRequest) {
    const subdomain = hostname.slice(0, -1 - ROOT_DOMAIN.length)
    if (subdomain && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = `/${subdomain}${pathname === '/' ? '' : pathname}`
      return NextResponse.rewrite(url)
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 2) Auth gate for the marketing/landing root only (apex domain)
  // ──────────────────────────────────────────────────────────────────
  if (pathname !== '/' || isSubdomainRequest) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Authenticated user -> redirect to first workspace
  // Unauthenticated user -> /login
  const url = request.nextUrl.clone()
  if (token) {
    // Fetch first workspace and redirect there
    try {
      const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`
      const res = await fetch(`${baseUrl}/api/workspaces`, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
        cache: 'no-store',
      })
      const data = await res.json()
      if (data?.success && data.data?.length > 0) {
        url.pathname = `/workspace/${data.data[0].slug}`
      } else {
        url.pathname = '/workspaces'
      }
    } catch {
      url.pathname = '/workspaces'
    }
  } else {
    url.pathname = '/login'
  }
  return NextResponse.redirect(url)
}

export const config = {
  // Run on every request except the API and static assets. The API
  // must keep its own host so webhook providers (VietQR, MISA, etc.)
  // can reach it on the apex domain.
  matcher: [
    /*
     * Match all request paths except:
     *  - /api/* (webhook routes need the apex host)
     *  - /_next/static, /_next/image (build assets)
     *  - /favicon.ico, /robots.txt, /sitemap.xml (root files)
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
}
