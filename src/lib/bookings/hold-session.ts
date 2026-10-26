/**
 * A guest's hold session on a hotel's site: one random id per browser, kept
 * in a cookie and sent as x-session-id when the booking page holds a room
 * (/api/bookings/room-lock). It used to be a new random id on every hold, so
 * each reload of the booking page added a 15-minute hold, and the page then
 * counted the guest's own hold as someone else's ("no longer available").
 * With one id, a reload replaces that session's hold, and the booking page
 * and the booking itself leave it out of their count.
 *
 * Client-safe: no database here (the lookups are in occupancy.ts).
 */
export const HOLD_COOKIE = 'ds-hold'
export const HOLD_HEADER = 'x-session-id'

const SESSION = /^[\w-]{1,64}$/

/** A session id as a browser sent it, or null when it is not one we make. */
export function holdSessionId(value: string | null | undefined): string | null {
  return value && SESSION.test(value) ? value : null
}

/** A day; the cookie covers the whole host and the page's script reads it. */
export const HOLD_COOKIE_MAX_AGE = 24 * 60 * 60

const fromCookie = () => holdSessionId(document.cookie.match(new RegExp(`(?:^|;\\s*)${HOLD_COOKIE}=([^;]*)`))?.[1])

/** In the browser: this visitor's hold session, made on first use. */
export function browserHoldSession(): string | null {
  try {
    const found = fromCookie()
    if (found) return found
    // getRandomValues, not randomUUID: the latter only exists on https and localhost.
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    const secure = location.protocol === 'https:' ? '; secure' : ''
    document.cookie = `${HOLD_COOKIE}=${id}; path=/; max-age=${HOLD_COOKIE_MAX_AGE}; samesite=lax${secure}`
    // Cookies off: still one id for this page view.
    return fromCookie() ?? id
  } catch {
    return null
  }
}
