/**
 * TOTP (RFC 6238) for two-factor sign-in: HMAC-SHA1, 6 digits, 30-second
 * steps, the settings every authenticator app (Google Authenticator,
 * Microsoft Authenticator, iPhone Passwords...) uses by default. Written on
 * node:crypto instead of adding a dependency; checked against the RFC's
 * test vectors in totp.test.ts.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SEC = 30
const DIGITS = 6
const SECRET_BYTES = 20

export function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/** Accepts lower case, spaces and '=' padding, as people type them. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (let i = 0; i < clean.length; i++) {
    const index = BASE32_ALPHABET.indexOf(clean[i])
    if (index === -1) throw new Error('invalid base32')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A new secret: 160 random bits, base32 (32 characters). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES))
}

export function timeStep(timestampMs: number): number {
  return Math.floor(timestampMs / 1000 / STEP_SEC)
}

/** The code for one time step (RFC 4226 dynamic truncation). */
export function totpForStep(secret: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 10 ** digits).padStart(digits, '0')
}

export function totpAt(secret: string, timestampMs: number, digits = DIGITS): string {
  return totpForStep(secret, timeStep(timestampMs), digits)
}

export interface TotpCheck {
  ok: boolean
  /** The matching time step, to store as the last one used. */
  step: number | null
}

/**
 * Accepts the current step and one step either side (clock drift), but
 * never a step at or before `lastUsedStep`: a code seen over someone's
 * shoulder cannot be replayed in its remaining seconds.
 */
export function verifyTotp(
  secret: string,
  code: string,
  { timestampMs = Date.now(), window = 1, lastUsedStep = null as number | null } = {}
): TotpCheck {
  if (!/^\d{6}$/.test(code)) return { ok: false, step: null }
  const current = timeStep(timestampMs)
  const given = Buffer.from(code)
  for (let step = current - window; step <= current + window; step++) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue
    if (timingSafeEqual(Buffer.from(totpForStep(secret, step)), given)) return { ok: true, step }
  }
  return { ok: false, step: null }
}

/** The otpauth:// URL that authenticator apps read from the QR code. */
export function otpauthUrl({ issuer, account, secret }: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SEC),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
