/**
 * A hotel's own domain, once /api/website/domain/verify attached it:
 *
 * - serving: src/middleware.ts asks /api/public/site-host which site a host
 *   belongs to (siteForCustomDomain) and serves that site on it;
 * - HTTPS: docker/certbot/custom-domains.sh, every minute on the VPS, asks
 *   /api/internal/custom-domains for the domains waiting for a certificate
 *   (domainsAwaitingCertificate), issues them with Let's Encrypt over HTTP
 *   (nginx answers the challenge for any host) and reports back
 *   (recordCertificate). nginx's custom-domains.conf picks the certificate by
 *   the name the browser asks for.
 *
 * Node only (Prisma).
 */
import { prisma } from '@/lib/db'

/** How long a failed issuance waits before the next try (Let's Encrypt limits failures per hour). */
export const RETRY_AFTER_MS = 60 * 60 * 1000
/** Domains handed to one run of the issuing script. */
const PER_RUN = 5

/** The subdomain of the site a verified custom domain serves, or null. */
export async function siteForCustomDomain(host: string): Promise<string | null> {
  const settings = await prisma.websiteSettings.findFirst({
    where: { customDomain: host, domainVerificationStatus: 'verified' },
    select: { property: { select: { subdomain: true } } },
  })
  return settings?.property.subdomain ?? null
}

/** Verified domains without a certificate, asked for, and not failed in the last hour. */
export async function domainsAwaitingCertificate(now = new Date()): Promise<string[]> {
  const rows = await prisma.websiteSettings.findMany({
    where: {
      customDomain: { not: null },
      domainVerificationStatus: 'verified',
      sslEnabled: false,
      sslRequestedAt: { not: null },
      OR: [{ sslError: null }, { sslCheckedAt: null }, { sslCheckedAt: { lt: new Date(now.getTime() - RETRY_AFTER_MS) } }],
    },
    orderBy: { sslRequestedAt: 'asc' },
    take: PER_RUN,
    select: { customDomain: true },
  })
  return rows.map((r) => r.customDomain!).filter(Boolean)
}

/** The issuing script's outcome for `domain`. Returns the property whose site changed, or null. */
export async function recordCertificate(domain: string, ok: boolean, now = new Date()): Promise<string | null> {
  const settings = await prisma.websiteSettings.findFirst({
    where: { customDomain: domain, domainVerificationStatus: 'verified' },
    select: { id: true, propertyId: true },
  })
  if (!settings) return null
  await prisma.websiteSettings.update({
    where: { id: settings.id },
    data: ok
      ? { sslEnabled: true, sslProvider: 'letsencrypt', sslVerifiedAt: now, sslCheckedAt: now, sslError: null }
      : { sslEnabled: false, sslCheckedAt: now, sslError: 'issue_failed' },
  })
  return settings.propertyId
}

/** The fields that ask for a (new) certificate: on verification, and on "Thử lại". */
export const certificateRequest = (now = new Date()) => ({
  sslRequestedAt: now,
  sslCheckedAt: null,
  sslError: null,
})
