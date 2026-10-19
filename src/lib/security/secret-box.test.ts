import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { randomBytes } from 'crypto'
import {
  KEYS_ENV,
  SecretBoxError,
  assertKeysValidIfSet,
  decryptSecret,
  encryptSecret,
  maskSecret,
  needsReEncrypt,
  parseKeyring,
  reEncryptSecret,
  secretContext,
} from './secret-box'

const newKey = () => randomBytes(32).toString('base64')
const KEY_1 = newKey()
const KEY_2 = newKey()
const CTX = secretContext('payment_settings', 'prop_a', 'apiKey')
const originalEnv = process.env[KEYS_ENV]

function useKeys(value: string | undefined) {
  if (value === undefined) delete process.env[KEYS_ENV]
  else process.env[KEYS_ENV] = value
}

/** Rebuilds a stored value with one part replaced. */
function withPart(stored: string, index: number, replace: (part: string) => string) {
  const parts = stored.split('.')
  parts[index] = replace(parts[index])
  return parts.join('.')
}

beforeEach(() => useKeys(`1:${KEY_1}`))
afterAll(() => useKeys(originalEnv))

describe('encryptSecret / decryptSecret', () => {
  it('round-trips, including Vietnamese text', () => {
    const secret = 'khoá-bí-mật-PayOS-123'
    const stored = encryptSecret(secret, CTX)
    expect(stored.startsWith('v1.1.')).toBe(true)
    expect(stored).not.toContain(secret)
    expect(decryptSecret(stored, CTX)).toBe(secret)
  })

  it('uses a fresh IV every time', () => {
    expect(encryptSecret('same', CTX)).not.toBe(encryptSecret('same', CTX))
  })

  it('rejects a value moved to another row or column', () => {
    const stored = encryptSecret('hotel A key', CTX)
    expect(() => decryptSecret(stored, secretContext('payment_settings', 'prop_b', 'apiKey'))).toThrow(
      SecretBoxError
    )
    expect(() => decryptSecret(stored, secretContext('payment_settings', 'prop_a', 'checksumKey'))).toThrow(
      SecretBoxError
    )
  })

  it('rejects a modified ciphertext, IV or tag', () => {
    const stored = encryptSecret('secret value', CTX)
    const flipFirstChar = (p: string) => (p[0] === 'A' ? 'B' : 'A') + p.slice(1)
    for (const index of [2, 3, 4]) {
      expect(() => decryptSecret(withPart(stored, index, flipFirstChar), CTX)).toThrow(
        /could not be decrypted/
      )
    }
  })

  it('rejects a truncated auth tag', () => {
    const stored = encryptSecret('secret value', CTX)
    const tag = Buffer.from(stored.split('.')[3], 'base64url')
    for (const length of [12, 8, 4]) {
      const short = withPart(stored, 3, () => tag.subarray(0, length).toString('base64url'))
      expect(() => decryptSecret(short, CTX)).toThrow(SecretBoxError)
    }
  })

  it('fails with the wrong key and says which key it needs', () => {
    const stored = encryptSecret('secret value', CTX)
    useKeys(`1:${KEY_2}`)
    expect(() => decryptSecret(stored, CTX)).toThrow(/could not be decrypted/)
    useKeys(`2:${KEY_2}`)
    expect(() => decryptSecret(stored, CTX)).toThrow(/key "1", which is not in DATA_ENCRYPTION_KEYS/)
  })

  it('never falls back to plaintext', () => {
    for (const stored of ['plain-password', 'enc:v1:aa:bb:cc', 'v1.1.only-three', 'v2.1.a.b.c', '']) {
      expect(() => decryptSecret(stored, CTX)).toThrow(/not a v1 encrypted secret/)
    }
  })

  it('requires a context and something to encrypt', () => {
    expect(() => encryptSecret('x', '')).toThrow(/context is required/)
    expect(() => decryptSecret(encryptSecret('x', CTX), '')).toThrow(/context is required/)
    expect(() => encryptSecret('', CTX)).toThrow(/store null/)
  })

  it('says how to fix a missing key', () => {
    useKeys(undefined)
    expect(() => encryptSecret('x', CTX)).toThrow(/DATA_ENCRYPTION_KEYS is not set/)
  })
})

describe('key rotation', () => {
  it('encrypts with the first key and still decrypts with older ones', () => {
    const old = encryptSecret('rotated secret', CTX)
    useKeys(`2:${KEY_2},1:${KEY_1}`)
    expect(needsReEncrypt(old)).toBe(true)
    expect(decryptSecret(old, CTX)).toBe('rotated secret')

    const fresh = reEncryptSecret(old, CTX)
    expect(fresh.startsWith('v1.2.')).toBe(true)
    expect(needsReEncrypt(fresh)).toBe(false)
    expect(reEncryptSecret(fresh, CTX)).toBe(fresh)

    useKeys(`2:${KEY_2}`)
    expect(decryptSecret(fresh, CTX)).toBe('rotated secret')
  })
})

describe('parseKeyring', () => {
  it('accepts base64 and base64url keys, newest first', () => {
    const url = randomBytes(32).toString('base64url')
    const ring = parseKeyring(` 2:${KEY_2} , 1:${url} `)
    expect(ring.activeId).toBe('2')
    expect(Array.from(ring.keys.keys())).toEqual(['2', '1'])
  })

  it.each([
    ['empty', ' , '],
    ['no key id', `:${KEY_1}`],
    ['no separator', KEY_1],
    ['bad key id', `key.1:${KEY_1}`],
    ['duplicate key id', `1:${KEY_1},1:${KEY_2}`],
    ['hex instead of base64', `1:${randomBytes(32).toString('hex')}`],
    ['too short', `1:${randomBytes(16).toString('base64')}`],
    ['all zeros', `1:${Buffer.alloc(32).toString('base64')}`],
    ['placeholder', '1:CHANGE_ME'],
  ])('rejects %s', (_, raw) => {
    expect(() => parseKeyring(raw)).toThrow(SecretBoxError)
  })

  it('never puts key material in its errors', () => {
    const hex = randomBytes(32).toString('hex')
    expect(() => parseKeyring(`1:${KEY_1},2:${hex}`)).toThrow(/entry 2 \("2"\)/)
    try {
      parseKeyring(`1:${KEY_1},2:${hex}`)
    } catch (error) {
      expect((error as Error).message).not.toContain(hex)
      expect((error as Error).message).not.toContain(KEY_1)
    }
  })
})

describe('assertKeysValidIfSet', () => {
  it('accepts an unset or valid value and rejects a malformed one', () => {
    useKeys(undefined)
    expect(() => assertKeysValidIfSet()).not.toThrow()
    useKeys(`1:${KEY_1}`)
    expect(() => assertKeysValidIfSet()).not.toThrow()
    useKeys('1:CHANGE_ME')
    expect(() => assertKeysValidIfSet()).toThrow(SecretBoxError)
  })
})

describe('secretContext', () => {
  it('joins the parts and refuses ambiguous ones', () => {
    expect(secretContext('payment_settings', 'clx1', 'apiKey')).toBe('payment_settings:clx1:apiKey')
    expect(() => secretContext()).toThrow(SecretBoxError)
    expect(() => secretContext('payment_settings', '', 'apiKey')).toThrow(SecretBoxError)
    expect(() => secretContext('payment_settings', 'a:b', 'apiKey')).toThrow(SecretBoxError)
  })
})

describe('maskSecret', () => {
  it('shows at most the last 4 characters', () => {
    expect(maskSecret('pk_live_abcdef123456')).toBe('••••3456')
    expect(maskSecret('short')).toBe('••••')
  })
})
