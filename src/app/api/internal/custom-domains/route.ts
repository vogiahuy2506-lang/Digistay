import { NextRequest, NextResponse } from 'next/server'
import { normalizeHostname } from '@/lib/custom-domain'
import { domainsAwaitingCertificate, recordCertificate } from '@/lib/public-site/custom-domains'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { checkCronSecret } from '@/lib/security/cron-secret'

/**
 * The HTTPS certificates of hotels' own domains, for
 * docker/certbot/custom-domains.sh on the VPS (every minute, from inside the
 * app container with CRON_SECRET; nginx does not route /api/internal/).
 *
 * GET: the domains to issue now, one per line (plain text for the shell).
 * POST domain=<host>&ok=1|0: the outcome of one issuance.
 */
export async function GET(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused
  const domains = await domainsAwaitingCertificate()
  return new NextResponse(domains.map((d) => `${d}\n`).join(''), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused
  const form = new URLSearchParams(await request.text())
  const domain = normalizeHostname(form.get('domain'))
  const ok = form.get('ok') === '1'
  if (!domain) return NextResponse.json({ success: false, error: 'domain' }, { status: 400 })
  const propertyId = await recordCertificate(domain, ok)
  if (!propertyId) return NextResponse.json({ success: false, error: 'unknown domain' }, { status: 404 })
  // The site's canonical address moves to the domain once it has HTTPS.
  invalidatePublicSite(propertyId)
  console.log(`[custom-domains] ${domain}: ${ok ? 'certificate issued' : 'issuance failed'}`)
  return NextResponse.json({ success: true })
}
