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
 * Dashboard pages drawn with the role colors: every workspace and property
 * page, profile and the operator pages (/admin). A page that still hard-codes light colors
 * (bg-white, text-gray-900...) must stay out of this list, or it turns half
 * dark; add a new page here once it uses only role colors.
 */
const darkReadyPaths: RegExp[] = [
  /^\/workspaces\/?$/,
  /^\/profile\/?$/,
  /^\/admin(\/(system|customers|orders|activity))?\/?$/,
  /^\/admin\/customers\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/(members|settings|billing)\/?$/,
  /^\/workspace\/[^/]+\/properties(\/new)?\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/bookings(\/[^/]+)?\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/(calendar|reports(\/daily)?|rooms|services|menu|policies|bank-accounts|website|payments|invoices)\/?$/,
]

export function isDarkReady(pathname: string | null | undefined): boolean {
  return !!pathname && darkReadyPaths.some((re) => re.test(pathname))
}

/** The theme a page actually gets. */
export function effectiveTheme(preference: ThemePreference, pathname: string | null | undefined): ThemePreference {
  return preference === 'dark' && isDarkReady(pathname) ? 'dark' : 'light'
}

/** Client only: remember the choice for a year. */
export function saveThemePreference(preference: ThemePreference) {
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`
}
