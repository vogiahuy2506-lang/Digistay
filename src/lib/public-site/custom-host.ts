/**
 * Which hotel site a custom domain (www.khachsan.vn) serves, for
 * src/middleware.ts. Edge-safe: the middleware cannot use the database, so it
 * asks the app's own /api/public/site-host and keeps the answer for a minute
 * (a missing one for half a minute: a domain just verified shows up quickly).
 */

const FOUND_MS = 60_000
const MISSING_MS = 30_000
const MAX_ENTRIES = 1000

const cache = new Map<string, { subdomain: string | null; until: number }>()

/** A host that could be a hotel's own domain: not Digistay's, not localhost, not an IP. */
export function isCustomDomainCandidate(hostname: string, root: string): boolean {
  if (!hostname || !hostname.includes('.')) return false
  if (hostname === root || hostname === `www.${root}` || hostname.endsWith(`.${root}`)) return false
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  if (/^[\d.]+$/.test(hostname) || hostname.startsWith('[')) return false
  return true
}

/** The app itself, as the middleware can reach it (inside the container, never through nginx). */
function appOrigin(): string {
  return process.env.INTERNAL_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`
}

/** The subdomain of the site `hostname` serves, or null. Never throws: a failed lookup is "not ours" for now. */
export async function siteForHost(hostname: string, now = Date.now()): Promise<string | null> {
  const hit = cache.get(hostname)
  if (hit && hit.until > now) return hit.subdomain
  let subdomain: string | null = null
  try {
    const res = await fetch(`${appOrigin()}/api/public/site-host?host=${encodeURIComponent(hostname)}`, {
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    })
    if (res.ok) {
      const data = (await res.json()) as { data?: { subdomain?: unknown } }
      if (typeof data.data?.subdomain === 'string') subdomain = data.data.subdomain
    } else if (res.status !== 404) {
      return hit?.subdomain ?? null // the app is busy: keep the last answer, don't cache
    }
  } catch {
    return hit?.subdomain ?? null
  }
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(hostname, { subdomain, until: now + (subdomain ? FOUND_MS : MISSING_MS) })
  return subdomain
}

/** Tests only. */
export function clearSiteHostCache() {
  cache.clear()
}
