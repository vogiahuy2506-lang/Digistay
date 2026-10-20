/**
 * One-time recovery codes for two-factor sign-in, for when the phone is
 * lost. Shown once, stored as sha256. Each code is 12 characters from an
 * alphabet without look-alikes (0/O, 1/I/L), about 59 random bits: unlike
 * passwords they are not chosen by people, so a fast hash is enough, and
 * 59 bits keep a leaked hash from being searched back to its code.
 */
import { createHash, randomInt } from 'crypto'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 12
const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`)
export const RECOVERY_CODE_COUNT = 8

/** Displayed as XXXX-XXXX-XXXX. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    let raw = ''
    for (let i = 0; i < CODE_LENGTH; i++) raw += ALPHABET[randomInt(ALPHABET.length)]
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
  })
}

/** Upper case without separators, or null if it cannot be a recovery code. */
export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, '')
  return CODE_RE.test(clean) ? clean : null
}

export function hashRecoveryCode(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex')
}
