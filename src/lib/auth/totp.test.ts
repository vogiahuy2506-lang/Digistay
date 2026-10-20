import { describe, it, expect } from 'vitest'
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUrl,
  timeStep,
  totpAt,
  totpForStep,
  verifyTotp,
} from './totp'

// RFC 6238 appendix B, SHA-1: the ASCII secret "12345678901234567890", 8 digits.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'))
const RFC_VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
]

describe('totp', () => {
  it('matches the RFC 6238 SHA-1 test vectors', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    for (const [seconds, code] of RFC_VECTORS) {
      expect(totpAt(RFC_SECRET, seconds * 1000, 8)).toBe(code)
      // 6-digit codes are the last 6 digits of the same truncation.
      expect(totpAt(RFC_SECRET, seconds * 1000)).toBe(code.slice(-6))
    }
  })

  it('round-trips base32 and reads what people type', () => {
    const bytes = Buffer.from('any bytes ÿ\u0000', 'latin1')
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes)
    expect(base32Decode('gezd gnbv gy3t qojq====')).toEqual(base32Decode('GEZDGNBVGY3TQOJQ'))
    expect(() => base32Decode('GEZ1')).toThrow()
  })

  it('generates 160-bit secrets', () => {
    const secret = generateTotpSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Decode(secret)).toHaveLength(20)
    expect(generateTotpSecret()).not.toBe(secret)
  })
})

describe('verifyTotp', () => {
  const secret = generateTotpSecret()
  const now = 1_800_000_000_000
  const step = timeStep(now)

  it('accepts the current step and one step of drift either way, not two', () => {
    expect(verifyTotp(secret, totpForStep(secret, step), { timestampMs: now })).toEqual({ ok: true, step })
    expect(verifyTotp(secret, totpForStep(secret, step - 1), { timestampMs: now }).ok).toBe(true)
    expect(verifyTotp(secret, totpForStep(secret, step + 1), { timestampMs: now }).ok).toBe(true)
    expect(verifyTotp(secret, totpForStep(secret, step - 2), { timestampMs: now }).ok).toBe(false)
    expect(verifyTotp(secret, totpForStep(secret, step + 2), { timestampMs: now }).ok).toBe(false)
  })

  it('refuses a step at or before the last one used', () => {
    const code = totpForStep(secret, step)
    expect(verifyTotp(secret, code, { timestampMs: now, lastUsedStep: step }).ok).toBe(false)
    expect(verifyTotp(secret, totpForStep(secret, step - 1), { timestampMs: now, lastUsedStep: step - 1 }).ok).toBe(
      false
    )
    expect(verifyTotp(secret, totpForStep(secret, step + 1), { timestampMs: now, lastUsedStep: step }).ok).toBe(true)
  })

  it('rejects anything but six digits, and codes of another secret', () => {
    for (const code of ['', '12345', '1234567', '12345a', ' 123456']) {
      expect(verifyTotp(secret, code, { timestampMs: now })).toEqual({ ok: false, step: null })
    }
    const other = generateTotpSecret()
    expect(verifyTotp(secret, totpForStep(other, step), { timestampMs: now }).ok).toBe(
      totpForStep(other, step) === totpForStep(secret, step)
    )
  })
})

describe('otpauthUrl', () => {
  it('builds the URL authenticator apps expect', () => {
    const url = new URL(otpauthUrl({ issuer: 'Digistay', account: 'an@example.com', secret: RFC_SECRET }))
    expect(url.protocol).toBe('otpauth:')
    expect(url.host).toBe('totp')
    expect(decodeURIComponent(url.pathname)).toBe('/Digistay:an@example.com')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      secret: RFC_SECRET,
      issuer: 'Digistay',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    })
  })
})
