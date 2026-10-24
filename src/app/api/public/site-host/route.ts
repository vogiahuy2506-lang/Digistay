import { NextRequest, NextResponse } from 'next/server'
import { normalizeHostname } from '@/lib/custom-domain'
import { siteForCustomDomain } from '@/lib/public-site/custom-domains'

/**
 * GET /api/public/site-host?host=www.khachsan.vn → { subdomain } of the site
 * that verified this domain, for src/middleware.ts (which cannot use the
 * database) to serve that site on it. 404 for any other host. Public: which
 * site a domain shows is what visiting it shows anyway.
 */
export async function GET(request: NextRequest) {
  const host = normalizeHostname(request.nextUrl.searchParams.get('host'))
  const subdomain = host ? await siteForCustomDomain(host) : null
  if (!subdomain) return NextResponse.json({ success: false }, { status: 404 })
  return NextResponse.json({ success: true, data: { subdomain } })
}
