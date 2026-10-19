/**
 * One-time email codes and password-reset tokens, stored in Redis.
 *
 * - Codes come from crypto.randomInt and only their SHA-256 is stored, under
 *   one key per purpose + email: a signup code cannot reset a password.
 * - Each code can be checked at most OTP_MAX_ATTEMPTS times. Attempts are
 *   counted with INCR *before* comparing, so parallel guesses cannot go
 *   past the limit; after that the code is deleted.
 * - A correct code is consumed with DEL and only the request whose DEL
 *   removed the key succeeds, so a code works once even under concurrency.
 * - A new code for the same purpose + email can be issued at most once per
 *   OTP_RESEND_COOLDOWN_SECONDS, which also caps guesses across reissues.
 * - Never log a code or token.
 */
import { createHash, randomBytes, randomInt } from 'crypto'
import { redis } from '@/lib/db/redis'

export type OtpPurpose = 'register' | 'forgot_password'
export const OTP_PURPOSES: readonly OtpPurpose[] = ['register', 'forgot_password']

export const OTP_TTL_SECONDS = 600
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_SECONDS = 60
export const RESET_TOKEN_TTL_SECONDS = 900

/** The subset of the ioredis client this module needs (a fake in tests). */
export interface OtpStore {
  set(key: string, value: string, mode: 'EX', seconds: number, flag?: 'NX'): Promise<'OK' | null>
  get(key: string): Promise<string | null>
  del(key: string): Promise<number>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
}

const defaultStore = redis as unknown as OtpStore

export class OtpCooldownError extends Error {
  constructor() {
    super('A code was sent recently; wait before requesting another one')
  }
}

export type OtpCheck = 'ok' | 'invalid' | 'too_many_attempts'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const codeKey = (purpose: OtpPurpose, email: string) => `otp:${purpose}:${normalizeEmail(email)}`
const attemptsKey = (purpose: OtpPurpose, email: string) => `otp_attempts:${purpose}:${normalizeEmail(email)}`
const cooldownKey = (purpose: OtpPurpose, email: string) => `otp_cooldown:${purpose}:${normalizeEmail(email)}`
const resetKey = (token: string) => `pwreset:${sha256(token)}`

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

/**
 * Creates and stores a new code, replacing any previous one for the same
 * purpose + email. Throws OtpCooldownError if one was issued too recently.
 */
export async function issueOtp(
  purpose: OtpPurpose,
  email: string,
  store: OtpStore = defaultStore
): Promise<string> {
  const allowed = await store.set(cooldownKey(purpose, email), '1', 'EX', OTP_RESEND_COOLDOWN_SECONDS, 'NX')
  if (allowed !== 'OK') throw new OtpCooldownError()

  const code = generateOtp()
  await store.set(codeKey(purpose, email), sha256(code), 'EX', OTP_TTL_SECONDS)
  await store.del(attemptsKey(purpose, email))
  return code
}

/** Checks a code and, if correct, consumes it. */
export async function consumeOtp(
  purpose: OtpPurpose,
  email: string,
  code: string,
  store: OtpStore = defaultStore
): Promise<OtpCheck> {
  const aKey = attemptsKey(purpose, email)
  const attempts = await store.incr(aKey)
  if (attempts === 1) await store.expire(aKey, OTP_TTL_SECONDS)
  if (attempts > OTP_MAX_ATTEMPTS) {
    await store.del(codeKey(purpose, email))
    return 'too_many_attempts'
  }

  const stored = await store.get(codeKey(purpose, email))
  if (!stored || stored !== sha256(code)) return 'invalid'

  if ((await store.del(codeKey(purpose, email))) !== 1) return 'invalid'
  await store.del(aKey)
  return 'ok'
}

/** Issues a single-use token proving the bearer passed the reset OTP. */
export async function issueResetToken(userId: string, store: OtpStore = defaultStore): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await store.set(resetKey(token), userId, 'EX', RESET_TOKEN_TTL_SECONDS)
  return token
}

/** Returns the user id the token was issued for, once; null otherwise. */
export async function consumeResetToken(token: string, store: OtpStore = defaultStore): Promise<string | null> {
  const userId = await store.get(resetKey(token))
  if (!userId) return null
  return (await store.del(resetKey(token))) === 1 ? userId : null
}
