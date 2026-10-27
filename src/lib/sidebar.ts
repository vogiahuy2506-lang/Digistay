/**
 * The dashboard sidebar's width and whether it is folded to a rail of
 * icons, kept in a cookie so the server draws it as the user left it (no
 * jump on load). Read in the workspace layout, written by WorkspaceShell.
 */

export const SIDEBAR_COOKIE = 'ds-sidebar'
export const SIDEBAR_DEFAULT = 256
/** Narrowest open sidebar: the logo row (home, bell, fold) still fits. */
export const SIDEBAR_MIN = 240
export const SIDEBAR_MAX = 400
/** The folded rail. */
export const SIDEBAR_RAIL = 64
/** Dragged narrower than this, the sidebar folds. */
export const SIDEBAR_FOLD_AT = 160

export interface SidebarPref {
  width: number
  collapsed: boolean
}

export function clampSidebarWidth(width: number): number {
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)))
}

/** "256", or "256c" when folded; anything else: the default. */
export function parseSidebarPref(value: string | undefined | null): SidebarPref {
  const match = /^(\d{1,4})(c?)$/.exec(value ?? '')
  if (!match) return { width: SIDEBAR_DEFAULT, collapsed: false }
  return { width: clampSidebarWidth(Number(match[1])), collapsed: match[2] === 'c' }
}

export function serializeSidebarPref(pref: SidebarPref): string {
  return `${clampSidebarWidth(pref.width)}${pref.collapsed ? 'c' : ''}`
}

/** Client only: remember it for a year. */
export function saveSidebarPref(pref: SidebarPref) {
  document.cookie = `${SIDEBAR_COOKIE}=${serializeSidebarPref(pref)}; path=/; max-age=31536000; samesite=lax`
}

/**
 * Pages that need the room (the website builder, whose preview is the
 * point): the sidebar is folded there whatever the preference, until the
 * user opens it on that page.
 */
const foldedPaths: RegExp[] = [/^\/workspace\/[^/]+\/properties\/[^/]+\/website\/?$/]

export function foldsSidebar(pathname: string | null | undefined): boolean {
  return !!pathname && foldedPaths.some((re) => re.test(pathname))
}
