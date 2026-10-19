/**
 * Encryption for third-party secrets stored in the database: hotels'
 * payment keys (Part 5), e-invoice credentials (Part 6), 2FA secrets (4f).
 * Server only. Never send a decrypted value to the browser: show
 * maskSecret() instead, and treat an empty form field as "keep the stored
 * value".
 *
 * Stored format, every part after the key id in base64url:
 *
 *   v1.<keyId>.<iv>.<tag>.<ciphertext>
 *
 * - AES-256-GCM with a random 12-byte IV per value and a 16-byte tag. The
 *   tag length is pinned on decrypt: without that, Node accepts a tag cut
 *   down to 4 bytes (measured on Node 20), i.e. a forgery 2^32 tries away.
 * - Keys come from DATA_ENCRYPTION_KEYS, `<keyId>:<base64 of 32 random
 *   bytes>`, comma-separated, newest first. New values use the first key;
 *   every listed key still decrypts, so keys rotate without downtime
 *   (docs/RUNBOOK.md, "Khoá mã hoá dữ liệu").
 * - `context` says where the value is stored, built with secretContext()
 *   (table, row id, column), and is authenticated as AAD: a value copied to
 *   another row or column fails to decrypt instead of quietly working, e.g.
 *   hotel A's payment key pasted onto hotel B.
 *
 * Unlike Founder AI's `enc:v1:`, there is no plaintext fallback: a stored
 * value that is not in this format is an error, never returned as is.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export const KEYS_ENV = 'DATA_ENCRYPTION_KEYS'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_ID_RE = /^[A-Za-z0-9_-]{1,32}$/
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/
// 32 bytes: 44 chars of base64 (one '=') or 43 of base64url. Anything else,
// notably `openssl rand -hex 32`, is rejected rather than reinterpreted.
const KEY_FORMAT_RE = /^(?:[A-Za-z0-9+/]{43}=|[A-Za-z0-9_-]{43})$/
// Random 32 bytes have ~30 distinct values; fewer than 16 means a
// placeholder such as all zeros or a repeated character.
const MIN_DISTINCT_KEY_BYTES = 16
const CONTEXT_SEPARATOR = ':'

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretBoxError'
  }
}

export interface Keyring {
  /** Key id used for new values: the first entry. */
  activeId: string
  keys: Map<string, Buffer>
}

/**
 * Parses DATA_ENCRYPTION_KEYS. Errors name the bad entry by position and
 * key id, never by value, so they are safe to log.
 */
export function parseKeyring(raw: string): Keyring {
  const entries = raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  if (entries.length === 0) throw new SecretBoxError(`${KEYS_ENV} is empty`)

  const keys = new Map<string, Buffer>()
  entries.forEach((entry, i) => {
    const where = `${KEYS_ENV} entry ${i + 1}`
    const sep = entry.indexOf(':')
    if (sep <= 0) throw new SecretBoxError(`${where}: expected <keyId>:<base64 key>`)
    const id = entry.slice(0, sep)
    if (!KEY_ID_RE.test(id)) {
      throw new SecretBoxError(`${where}: the key id must be 1-32 characters of A-Z a-z 0-9 _ -`)
    }
    if (keys.has(id)) throw new SecretBoxError(`${where}: duplicate key id "${id}"`)
    const key = decodeKey(entry.slice(sep + 1))
    if (!key) {
      throw new SecretBoxError(
        `${where} ("${id}"): the key must be 32 random bytes in base64 (openssl rand -base64 32)`
      )
    }
    keys.set(id, key)
  })
  return { activeId: entries[0].slice(0, entries[0].indexOf(':')), keys }
}

function decodeKey(encoded: string): Buffer | null {
  if (!KEY_FORMAT_RE.test(encoded)) return null
  const key = Buffer.from(encoded, encoded.endsWith('=') ? 'base64' : 'base64url')
  if (key.length !== KEY_BYTES) return null
  if (new Set(key).size < MIN_DISTINCT_KEY_BYTES) return null
  return key
}

let cached: { raw: string; ring: Keyring } | null = null

function loadKeyring(): Keyring {
  const raw = process.env[KEYS_ENV]?.trim()
  if (!raw) {
    throw new SecretBoxError(`${KEYS_ENV} is not set (docs/RUNBOOK.md, "Khoá mã hoá dữ liệu")`)
  }
  if (cached?.raw !== raw) cached = { raw, ring: parseKeyring(raw) }
  return cached.ring
}

/**
 * For /api/health: throws when DATA_ENCRYPTION_KEYS is set but malformed,
 * so a deploy with a broken key fails (and rolls back) instead of failing
 * later on the first payment. Unset is fine until a feature needs it.
 */
export function assertKeysValidIfSet(): void {
  if (process.env[KEYS_ENV]?.trim()) loadKeyring()
}

/**
 * Names where a secret is stored: secretContext('payment_settings',
 * propertyId, 'apiKey'). Use the row's id, never something users can edit.
 */
export function secretContext(...parts: string[]): string {
  if (parts.length === 0 || parts.some((p) => !p || p.includes(CONTEXT_SEPARATOR))) {
    throw new SecretBoxError(
      `secretContext: every part must be non-empty and free of "${CONTEXT_SEPARATOR}"`
    )
  }
  return parts.join(CONTEXT_SEPARATOR)
}

function assertContext(context: string) {
  if (typeof context !== 'string' || context.length === 0) {
    throw new SecretBoxError('a context is required (use secretContext)')
  }
}

function aad(keyId: string, context: string): Buffer {
  return Buffer.from(`${VERSION}.${keyId}.${context}`, 'utf8')
}

/** Encrypts with the active key. Store null, not '', for "not configured". */
export function encryptSecret(plaintext: string, context: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new SecretBoxError('nothing to encrypt: store null for "not configured"')
  }
  assertContext(context)
  const ring = loadKeyring()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, ring.keys.get(ring.activeId)!, iv, {
    authTagLength: TAG_BYTES,
  })
  cipher.setAAD(aad(ring.activeId, context))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    VERSION,
    ring.activeId,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

interface StoredParts {
  keyId: string
  iv: Buffer
  tag: Buffer
  ciphertext: Buffer
}

function parseStored(stored: string): StoredParts {
  const parts = typeof stored === 'string' ? stored.split('.') : []
  const [version, keyId, iv, tag, ciphertext] = parts
  if (
    parts.length !== 5 ||
    version !== VERSION ||
    !KEY_ID_RE.test(keyId) ||
    ![iv, tag, ciphertext].every((p) => BASE64URL_RE.test(p))
  ) {
    throw new SecretBoxError(`not a ${VERSION} encrypted secret`)
  }
  const decoded = {
    keyId,
    iv: Buffer.from(iv, 'base64url'),
    tag: Buffer.from(tag, 'base64url'),
    ciphertext: Buffer.from(ciphertext, 'base64url'),
  }
  if (decoded.iv.length !== IV_BYTES || decoded.tag.length !== TAG_BYTES) {
    throw new SecretBoxError(`not a ${VERSION} encrypted secret`)
  }
  return decoded
}

export function decryptSecret(stored: string, context: string): string {
  assertContext(context)
  const { keyId, iv, tag, ciphertext } = parseStored(stored)
  const key = loadKeyring().keys.get(keyId)
  if (!key) {
    throw new SecretBoxError(`secret was encrypted with key "${keyId}", which is not in ${KEYS_ENV}`)
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES })
    decipher.setAAD(aad(keyId, context))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new SecretBoxError(
      `secret for "${context}" could not be decrypted (wrong key, wrong context or modified data)`
    )
  }
}

/** True when the value was encrypted with an older key (rotation pending). */
export function needsReEncrypt(stored: string): boolean {
  return parseStored(stored).keyId !== loadKeyring().activeId
}

/** Re-encrypts with the active key if needed; for the rotation script. */
export function reEncryptSecret(stored: string, context: string): string {
  return needsReEncrypt(stored) ? encryptSecret(decryptSecret(stored, context), context) : stored
}

/** What the UI may show: the last 4 characters, and only of a long value. */
export function maskSecret(plaintext: string): string {
  return plaintext.length >= 8 ? `••••${plaintext.slice(-4)}` : '••••'
}
