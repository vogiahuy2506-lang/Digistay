/**
 * "Log out everywhere" for JWT sessions.
 *
 * Sessions are self-contained JWTs (30 days), so the server cannot delete
 * them. Instead, changing a password or turning on two-factor sign-in
 * records the time in Redis, and the jwt callback refuses any token whose
 * sign-in time (token.authTime, ms) is older. Throwing from the jwt
 * callback makes next-auth clear the session cookie, and
 * getServerSession() returns null.
 *
 * Fail-open on Redis errors, like the rate limits (decision 2026-10-19).
 */
import { redis } from '@/lib/db/redis'

/** Must cover authOptions.session.maxAge: older tokens expire on their own. */
const REVOCATION_TTL_SEC = 30 * 24 * 60 * 60

export interface RevocationStore {
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>
  get(key: string): Promise<string | null>
}

const defaultStore = redis as unknown as RevocationStore
const keyFor = (userId: string) => `auth:revoked_before:${userId}`

export class SessionRevokedError extends Error {
  constructor() {
    super('Session revoked (password changed or two-factor sign-in turned on)')
  }
}

/** Ends every session of this user that started before `now`. */
export async function revokeSessions(
  userId: string,
  now: number = Date.now(),
  store: RevocationStore = defaultStore
): Promise<void> {
  try {
    await store.set(keyFor(userId), String(now), 'EX', REVOCATION_TTL_SEC)
  } catch (error) {
    console.error('[session-revocation] could not revoke sessions:', error)
  }
}

/** True if a session that started at `authTime` (ms) has been revoked. */
export async function isSessionRevoked(
  userId: string,
  authTime: number,
  store: RevocationStore = defaultStore
): Promise<boolean> {
  try {
    const revokedBefore = await store.get(keyFor(userId))
    return revokedBefore !== null && authTime < Number(revokedBefore)
  } catch (error) {
    console.error('[session-revocation] check failed, allowing session:', error)
    return false
  }
}
