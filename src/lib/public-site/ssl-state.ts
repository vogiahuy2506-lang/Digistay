/**
 * Where a site's custom domain and its HTTPS certificate stand (no Prisma:
 * the builder uses it too). See src/lib/public-site/custom-domains.ts.
 */
/** Where a site's certificate stands, for the builder. */
export type SslState = 'none' | 'pending' | 'active' | 'failed'

export function sslState(settings: {
  customDomain?: string | null
  domainVerificationStatus?: string | null
  sslEnabled?: boolean | null
  sslRequestedAt?: Date | string | null
  sslError?: string | null
}): SslState {
  if (!settings.customDomain || settings.domainVerificationStatus !== 'verified') return 'none'
  if (settings.sslEnabled) return 'active'
  if (settings.sslError) return 'failed'
  return settings.sslRequestedAt ? 'pending' : 'none'
}
