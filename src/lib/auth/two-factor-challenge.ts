/**
 * The ticket between "password (or Google) accepted" and "second factor
 * entered" (Part 4f). No session exists until the code is right; this
 * ticket only lets the `two-factor` sign-in provider ask for that code.
 *
 * Stateless: HMAC-SHA256 with a key derived from NEXTAUTH_SECRET for this
 * purpose only, so it can never pass for a session (next-auth encrypts
 * those with its own derived key), and sign-in does not depend on Redis.
 * It lasts 5 minutes. Guessing codes with it still counts toward the
 * per-account lock, and the caller rejects tickets issued before a
 * password change (isSessionRevoked).
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'crypto'

const PREFIX = 'tfc1'
const TTL_MS = 5 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 60 * 1000

export type ChallengeMethod = 'password' | 'google'

export interface Challenge {
  userId: string
  method: ChallengeMethod
  /** ms since epoch */
  issuedAt: number
}

function signingKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return Buffer.from(hkdfSync('sha256', secret, '', 'digistay two-factor challenge v1', 32))
}

function sign(payload: string): Buffer {
  return createHmac('sha256', signingKey()).update(`${PREFIX}.${payload}`).digest()
}

export function issueChallenge(userId: string, method: ChallengeMethod, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, m: method, iat: now })).toString('base64url')
  return `${PREFIX}.${payload}.${sign(payload).toString('base64url')}`
}

/** The challenge, or null if it is forged, malformed or expired. */
export function readChallenge(token: unknown, now = Date.now()): Challenge | null {
  if (typeof token !== 'string') return null
  const [prefix, payload, signature, ...rest] = token.split('.')
  if (prefix !== PREFIX || !payload || !signature || rest.length > 0) return null

  const expected = sign(payload)
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  let data: { u?: unknown; m?: unknown; iat?: unknown }
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const { u, m, iat } = data
  if (typeof u !== 'string' || !u || (m !== 'password' && m !== 'google') || typeof iat !== 'number') return null
  if (now - iat > TTL_MS || iat - now > MAX_CLOCK_SKEW_MS) return null
  return { userId: u, method: m, issuedAt: iat }
}
