/**
 * Where a hotel's public pages live, for building links inside them.
 *
 * The same pages answer on the app's own host (digistay.vn/<subdomain>/rooms/x)
 * and, once the subdomain middleware runs, on the hotel's host
 * (<subdomain>.digistay.vn/rooms/x or a custom domain), where the middleware
 * adds the "/<subdomain>" itself. Links must carry the prefix in the first
 * case and must not in the second, or they point to /<subdomain>/<subdomain>/...
 */
export function siteBasePath(
  subdomain: string,
  host: string | null | undefined,
  appUrl: string | undefined = process.env.NEXTAUTH_URL
): string {
  const prefixed = `/${encodeURIComponent(subdomain)}`
  const hostname = (host ?? '').trim().toLowerCase().replace(/:\d+$/, '')
  if (!hostname) return prefixed

  // The hotel's own subdomain: foo.digistay.vn, foo.localhost.
  if (hostname.startsWith(`${subdomain.toLowerCase()}.`)) return ''

  // localhost and IP addresses are always the app itself.
  if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.startsWith('[')) return prefixed

  let appHost = ''
  try {
    appHost = appUrl ? new URL(appUrl).hostname.toLowerCase() : ''
  } catch {
    appHost = ''
  }
  const bare = (h: string) => h.replace(/^www\./, '')
  if (!appHost || bare(hostname) === bare(appHost)) return prefixed

  // Any other host can only be a domain the middleware maps to this hotel.
  return ''
}

/** `base` from siteBasePath + a path inside the site ("/", "/search?…", "/rooms/x"). */
export function siteHref(base: string, path: string): string {
  if (path === '/' || path === '') return base || '/'
  // A section of the home page: "/may-bien#rooms", not "/may-bien/#rooms".
  if (path.startsWith('/#')) return `${base}${base ? path.slice(1) : path}`
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
