/**
 * Property sites on subdomains: <subdomain>.digistay.vn serves the same
 * pages as digistay.vn/<subdomain> (src/middleware.ts). Edge-safe: no Node
 * or database imports.
 */

/**
 * Never available to a property: the app's own top-level routes (a property
 * called "login" would otherwise take login.digistay.vn and shadow
 * digistay.vn/login) and names people expect to belong to the platform.
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  // top-level routes of src/app
  'api', 'contact', 'forgot-password', 'invitations', 'login', 'pricing', 'profile', 'register',
  'workspace', 'workspace-picker', 'workspaces', 'search', 'rooms', 'thanh-toan',
  // platform and infrastructure names
  'www', 'app', 'admin', 'administrator', 'root', 'auth', 'account', 'accounts', 'billing',
  'dashboard', 'docs', 'help', 'support', 'status', 'blog', 'news', 'about', 'terms', 'privacy',
  'static', 'assets', 'cdn', 'img', 'images', 'media', 'files', 'download', 'mail', 'email',
  'smtp', 'imap', 'pop', 'ftp', 'ns1', 'ns2', 'dns', 'vpn', 'webhook', 'webhooks', 'internal',
  'dev', 'staging', 'test', 'demo', 'beta', 'digistay',
])

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/

/** Same rules as DNS labels, minus the reserved names. */
export function isAllowedSubdomain(value: string): boolean {
  return SUBDOMAIN_RE.test(value) && !RESERVED_SUBDOMAINS.has(value)
}

/**
 * The domain property sites live under: ROOT_DOMAIN, else the host of
 * NEXTAUTH_URL without "www.", else "localhost" (bar.localhost:3000 works
 * in development).
 */
export function rootDomain(env: Record<string, string | undefined> = process.env): string {
  if (env.ROOT_DOMAIN) return env.ROOT_DOMAIN.toLowerCase()
  try {
    if (env.NEXTAUTH_URL) return new URL(env.NEXTAUTH_URL).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    // fall through
  }
  return 'localhost'
}

/** The property subdomain a request's host names, if any (one level, not reserved). */
export function subdomainOf(host: string, root: string): string | null {
  const hostname = host.split(':')[0].toLowerCase()
  if (!hostname.endsWith(`.${root}`)) return null
  const label = hostname.slice(0, -root.length - 1)
  if (label.includes('.') || !SUBDOMAIN_RE.test(label) || RESERVED_SUBDOMAINS.has(label)) return null
  return label
}
