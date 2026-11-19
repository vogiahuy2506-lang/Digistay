/**
 * Dashboard theme preference (light / dark), kept in a cookie so the server
 * renders the right theme on the first paint.
 */

export type ThemePreference = 'light' | 'dark'

export const THEME_COOKIE = 'ds-theme'

export function parseThemePreference(value: string | undefined | null): ThemePreference {
  return value === 'dark' ? 'dark' : 'light'
}

/**
 * Normalizes short dashboard URLs (/app/[slug]/...) to canonical workspace
 * URLs (/workspace/[slug]/...) matching the Next.js server rewrite.
 */
export function normalizeDashboardPath(pathname: string): string {
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    const [, , slug, third, ...more] = pathname.split('/')
    if (!slug) return pathname
    const WORKSPACE_SECTIONS = new Set(['members', 'billing', 'settings', 'help', 'notifications', 'properties'])
    if (!third) {
      return `/workspace/${slug}`
    }
    if (WORKSPACE_SECTIONS.has(third)) {
      return `/workspace/${slug}/${third}${more.length ? `/${more.join('/')}` : ''}`
    }
    return `/workspace/${slug}/properties/${third}${more.length ? `/${more.join('/')}` : ''}`
  }
  return pathname
}

/**
 * Dashboard pages drawn with the role colors: every workspace and property
 * page, profile and the operator pages (/admin). A page that still hard-codes light colors
 * (bg-white, text-gray-900...) must stay out of this list, or it turns half
 * dark; add a new page here once it uses only role colors.
 */
const darkReadyPaths: RegExp[] = [
  /^\/workspaces\/?$/,
  /^\/profile\/?$/,
  /^\/billing(\/checkout)?\/?$/,
  /^\/admin(\/(system|customers|orders|activity|plans|einvoices|platform-settings|security|team|vouchers))?\/?$/,
  /^\/admin\/customers\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/(members|settings|billing(\/checkout)?|notifications|help)\/?$/,
  /^\/workspace\/[^/]+\/properties(\/new)?\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/bookings(\/new|\/[^/]+)?\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/blog(\/new|\/[^/]+)?\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/customers(\/[^/]+)?\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/(calendar|reports(\/daily)?|rooms|services|menu|policies|coupons|bank-accounts|website|payments|invoices|leads|customers|blog|channels|cashbook|settings)\/?$/,
]

export function isDarkReady(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = normalizeDashboardPath(pathname)
  return darkReadyPaths.some((re) => re.test(normalized))
}

/** The theme a page actually gets. */
export function effectiveTheme(preference: ThemePreference, pathname: string | null | undefined): ThemePreference {
  return preference === 'dark' && isDarkReady(pathname) ? 'dark' : 'light'
}

/** Client only: remember the choice for a year. */
export function saveThemePreference(preference: ThemePreference) {
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`
}
