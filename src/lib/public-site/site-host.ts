/**
 * Which origin a hotel's site is known by, for canonical links, the sitemap
 * and structured data, and which site a request's host names (robots.txt
 * and sitemap.xml answer on every host, src/app/robots.ts).
 *
 * The same pages answer on <subdomain>.digistay.vn, digistay.vn/<subdomain>
 * and, once it serves, the hotel's own domain; search engines are told one
 * of them. Edge-safe: no Node or database imports.
 */
import { rootDomain, subdomainOf } from '@/lib/subdomains'

type Env = Record<string, string | undefined>

/** The custom-domain fields of WebsiteSettings. */
export interface SiteDomainSettings {
  customDomain: string | null
  domainVerificationStatus: string | null
  sslEnabled: boolean
}

export const SITE_DOMAIN_SELECT = { customDomain: true, domainVerificationStatus: true, sslEnabled: true } as const

const HOSTNAME_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/

const isLocalhost = (hostname: string) => hostname === 'localhost' || hostname.endsWith('.localhost')

/** The app's own URL as configured, or null. */
function appUrl(env: Env): URL | null {
  for (const value of [env.NEXTAUTH_URL, env.NEXT_PUBLIC_SITE_URL]) {
    try {
      if (value) return new URL(value)
    } catch {
      // try the next one
    }
  }
  return null
}

/**
 * The hotel's canonical origin: its own domain once that is verified and
 * has a certificate, else its subdomain of the root domain. In development
 * (root domain localhost) it is http, with the app's port.
 */
export function canonicalSiteOrigin(
  subdomain: string,
  settings: SiteDomainSettings | null | undefined,
  env: Env = process.env
): string {
  const custom = settings?.customDomain?.trim().toLowerCase()
  // A hostname only (the verify route normalizes it): the origin goes into XML and HTML unescaped.
  if (custom && HOSTNAME_RE.test(custom) && settings?.domainVerificationStatus === 'verified' && settings.sslEnabled) {
    return `https://${custom}`
  }

  const root = rootDomain(env)
  if (!isLocalhost(root)) return `https://${subdomain}.${root}`
  const app = appUrl(env)
  const port = app && isLocalhost(app.hostname) && app.port ? `:${app.port}` : ''
  return `http://${subdomain}.${root}${port}`
}

/** Digistay's own origin (the marketing pages): the app's URL, else https://<root domain>. */
export function appOrigin(env: Env = process.env): string {
  const app = appUrl(env)
  if (app) return app.origin
  const root = rootDomain(env)
  return isLocalhost(root) ? `http://${root}` : `https://${root}`
}

export type HostSite =
  /** digistay.vn, www.digistay.vn, the app's own host. */
  | { kind: 'digistay' }
  /** <subdomain>.digistay.vn */
  | { kind: 'subdomain'; subdomain: string }
  /** Any other host: maybe a hotel's own domain (WebsiteSettings.customDomain). */
  | { kind: 'other'; hostname: string }

/** What a request's Host header names. */
export function hostSite(host: string | null | undefined, env: Env = process.env): HostSite {
  const hostname = (host ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  const root = rootDomain(env)
  const app = appUrl(env)?.hostname.toLowerCase()
  if (hostname === root || hostname === `www.${root}` || (app && hostname === app)) return { kind: 'digistay' }
  const subdomain = subdomainOf(hostname, root)
  return subdomain ? { kind: 'subdomain', subdomain } : { kind: 'other', hostname }
}
