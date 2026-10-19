/**
 * Runs against an in-memory fake of the Redis commands used. Set
 * TEST_REDIS_URL (e.g. redis://127.0.0.1:6379/15) to run the same suite
 * against a real Redis as well; it uses keys under a random prefix-free
 * email domain and deletes nothing else.
 */
import { describe, it, expect, vi, afterAll } from 'vitest'
import Redis from 'ioredis'

vi.mock('@/lib/db/redis', () => ({ redis: {} }))

import {
  consumeOtp,
  consumeResetToken,
  generateOtp,
  issueOtp,
  issueResetToken,
  OtpCooldownError,
  OTP_MAX_ATTEMPTS,
  type OtpStore,
} from './otp'

function fakeStore(): OtpStore & { dump(): Map<string, string> } {
  const data = new Map<string, string>()
  const tick = () => new Promise((r) => setTimeout(r, 0)) // let other calls interleave
  return {
    dump: () => data,
    async set(key, value, _mode, _seconds, flag) {
      await tick()
      if (flag === 'NX' && data.has(key)) return null
      data.set(key, value)
      return 'OK'
    },
    async get(key) {
      await tick()
      return data.get(key) ?? null
    },
    async del(key) {
      await tick()
      return data.delete(key) ? 1 : 0
    },
    async incr(key) {
      await tick()
      const n = Number(data.get(key) ?? 0) + 1
      data.set(key, String(n))
      return n
    },
    async expire() {
      await tick()
      return 1
    },
  }
}

const realRedis = process.env.TEST_REDIS_URL ? new Redis(process.env.TEST_REDIS_URL) : null
afterAll(() => realRedis?.disconnect())

const stores: [string, () => OtpStore][] = [['fake store', fakeStore]]
if (realRedis) stores.push(['real Redis', () => realRedis as unknown as OtpStore])

let n = 0
const freshEmail = () => `otp-test-${Date.now()}-${n++}@example.test`

describe('generateOtp', () => {
  it('always returns 6 digits, including leading zeros', () => {
    for (let i = 0; i < 2000; i++) expect(generateOtp()).toMatch(/^\d{6}$/)
  })
})

describe.each(stores)('OTP on %s', (_name, makeStore) => {
  it('accepts the issued code once', async () => {
    const store = makeStore()
    const email = freshEmail()
    const code = await issueOtp('forgot_password', email, store)
    expect(await consumeOtp('forgot_password', email, code, store)).toBe('ok')
    expect(await consumeOtp('forgot_password', email, code, store)).toBe('invalid')
  })

  it('normalizes the email (case and spaces)', async () => {
    const store = makeStore()
    const email = freshEmail()
    const code = await issueOtp('register', `  ${email.toUpperCase()} `, store)
    expect(await consumeOtp('register', email, code, store)).toBe('ok')
  })

  it('a signup code cannot be used to reset a password', async () => {
    const store = makeStore()
    const email = freshEmail()
    const code = await issueOtp('register', email, store)
    expect(await consumeOtp('forgot_password', email, code, store)).toBe('invalid')
    expect(await consumeOtp('register', email, code, store)).toBe('ok')
  })

  it(`after ${OTP_MAX_ATTEMPTS} wrong attempts even the right code is refused`, async () => {
    const store = makeStore()
    const email = freshEmail()
    const code = await issueOtp('forgot_password', email, store)
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      expect(await consumeOtp('forgot_password', email, wrong, store)).toBe('invalid')
    }
    expect(await consumeOtp('forgot_password', email, code, store)).toBe('too_many_attempts')
  })

  it('parallel guesses cannot exceed the attempt limit', async () => {
    const store = makeStore()
    const email = freshEmail()
    const code = await issueOtp('forgot_password', email, store)
    const guesses = Array.from({ length: 20 }, (_, i) => String(i).padStart(6, '0')).filter((g) => g !== code)
    const results = await Promise.all(guesses.map((g) => consumeOtp('forgot_password', email, g, store)))
    expect(results.filter((r) => r === 'invalid')).toHaveLength(OTP_MAX_ATTEMPTS)
    expect(await consumeOtp('forgot_password', email, code, store)).toBe('too_many_attempts')
  })

  it('the same correct code submitted twice at once succeeds only once', async () => {
    const store = makeStore()
    const email = freshEmail()
    const code = await issueOtp('forgot_password', email, store)
    const results = await Promise.all([1, 2, 3].map(() => consumeOtp('forgot_password', email, code, store)))
    expect(results.filter((r) => r === 'ok')).toHaveLength(1)
  })

  it('refuses a second code within the resend cooldown', async () => {
    const store = makeStore()
    const email = freshEmail()
    await issueOtp('register', email, store)
    await expect(issueOtp('register', email, store)).rejects.toBeInstanceOf(OtpCooldownError)
  })

  it('reset tokens work once and only for the user they were issued to', async () => {
    const store = makeStore()
    const token = await issueResetToken('user-42', store)
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(await consumeResetToken(token, store)).toBe('user-42')
    expect(await consumeResetToken(token, store)).toBeNull()
    expect(await consumeResetToken('not-a-real-token', store)).toBeNull()
  })
})

describe('storage', () => {
  it('stores hashes, never the code or the reset token', async () => {
    const store = fakeStore()
    const email = freshEmail()
    const code = await issueOtp('forgot_password', email, store)
    const token = await issueResetToken('user-1', store)
    const stored = Array.from(store.dump().entries()).flat().join('|')
    expect(stored).not.toContain(code)
    expect(stored).not.toContain(token)
  })
})
