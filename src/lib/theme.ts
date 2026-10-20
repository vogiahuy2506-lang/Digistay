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
 * Dashboard pages already drawn with the role colors. Others still hard-code
 * light colors (bg-white, text-gray-900...), so they stay light whatever the
 * preference; add a page here once it uses only role colors.
 */
const darkReadyPaths: RegExp[] = [
  /^\/workspaces\/?$/,
  /^\/profile\/?$/,
  /^\/workspace\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/(members|settings)\/?$/,
  /^\/workspace\/[^/]+\/properties(\/new)?\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/?$/,
  /^\/workspace\/[^/]+\/properties\/[^/]+\/bookings(\/[^/]+)?\/?$/,
  // Payments and invoices wait for #41 and the PayOS / Mắt Bão chain, which
  // rewrite both pages; they move to role colors after those merge.
  /^\/workspace\/[^/]+\/properties\/[^/]+\/(calendar|reports(\/daily)?|rooms|services|policies|bank-accounts|website)\/?$/,
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
