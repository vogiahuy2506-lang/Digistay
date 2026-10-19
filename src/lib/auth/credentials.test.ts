/**
 * Sign-in brute-force protection (authorizeWithPassword) and session
 * revocation in the jwt callback. Real bcrypt (low-cost hashes for speed),
 * Redis faked in memory, Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

const h = vi.hoisted(() => {
  const data = new Map<string, string>()
  const redis = {
    async set(key: string, value: string) {
      data.set(key, value)
      return 'OK'
    },
    async get(key: string) {
      return data.get(key) ?? null
    },
    async del(key: string) {
      return data.delete(key) ? 1 : 0
    },
    async incr(key: string) {
      const n = Number(data.get(key) ?? 0) + 1
      data.set(key, String(n))
      return n
    },
    async expire() {
      return 1
    },
    async ttl() {
      return 60
    },
  }
  return { data, redis }
})

vi.mock('@/lib/db/redis', () => ({ redis: h.redis }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findFirst: vi.fn(), findUnique: vi.fn() } } }))

import { prisma } from '@/lib/db'
import { authorizeWithPassword, LOGIN_ERRORS, unlockAccount } from './credentials'
import { revokeSessions, SessionRevokedError } from './session-revocation'
import { authOptions } from './index'

const db = prisma as unknown as { user: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> } }

const RIGHT = 'right-password'
const HASH = bcrypt.hashSync(RIGHT, 4)
const userNamed = (name: string) => ({
  id: `id-${name}`,
  username: name,
  email: `${name}@example.com`,
  name,
  image: null,
  role: 'USER',
  password: HASH,
  emailVerified: new Date(),
})

const fromIp = (ip: string, extra: Record<string, string> = {}) => ({ 'x-real-ip': ip, ...extra })
const login = (username: string, password: string, ip = '198.51.100.1', extra?: Record<string, string>) =>
  authorizeWithPassword({ username, password }, fromIp(ip, extra))

beforeEach(() => {
  vi.clearAllMocks()
  h.data.clear()
  db.user.findFirst.mockImplementation(async ({ where }: { where: { OR: { username?: string }[] } }) =>
    userNamed(where.OR[0].username!)
  )
})

describe('sign-in', () => {
  it('the right password signs in', async () => {
    expect(await login('alice', RIGHT)).toMatchObject({ id: 'id-alice', email: 'alice@example.com' })
  })

  it('10 wrong passwords for one name from one IP block the 11th try, even with the right password', async () => {
    for (let i = 0; i < 10; i++) await expect(login('alice', 'nope')).rejects.toThrow(LOGIN_ERRORS.invalid)
    await expect(login('alice', RIGHT)).rejects.toThrow(LOGIN_ERRORS.tooMany)
  })

  it('a different name from the same IP is not blocked by that counter', async () => {
    for (let i = 0; i < 10; i++) await expect(login('alice', 'nope')).rejects.toThrow()
    expect(await login('bob', RIGHT)).toMatchObject({ id: 'id-bob' })
  })

  it('50 failures across many names from one IP block that IP', async () => {
    for (let i = 0; i < 50; i++) await expect(login(`user${i}`, 'nope')).rejects.toThrow(LOGIN_ERRORS.invalid)
    await expect(login('carol', RIGHT)).rejects.toThrow(LOGIN_ERRORS.tooMany)
    expect(await login('carol', RIGHT, '198.51.100.2')).toMatchObject({ id: 'id-carol' })
  })

  it('X-Forwarded-For cannot be rotated to escape the limit', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(login('alice', 'nope', '198.51.100.1', { 'x-forwarded-for': `10.0.0.${i}` })).rejects.toThrow()
    }
    await expect(login('alice', RIGHT, '198.51.100.1', { 'x-forwarded-for': '10.9.9.9' })).rejects.toThrow(
      LOGIN_ERRORS.tooMany
    )
  })

  it('successes do not count: one office IP can sign in repeatedly', async () => {
    for (let i = 0; i < 30; i++) expect(await login('alice', RIGHT)).toBeTruthy()
  })
})

describe('account lock', () => {
  const lockAlice = async () => {
    for (let i = 0; i < 5; i++) {
      await expect(login('alice', 'nope', `203.0.113.${i}`)).rejects.toThrow(LOGIN_ERRORS.invalid)
    }
  }

  it('5 failures from different IPs lock the account', async () => {
    await lockAlice()
    await expect(login('alice', RIGHT, '203.0.113.99')).rejects.toThrow(LOGIN_ERRORS.locked)
  })

  it('a wrong password on a locked account gets the usual generic error (lock not revealed)', async () => {
    await lockAlice()
    await expect(login('alice', 'still-wrong', '203.0.113.98')).rejects.toThrow(LOGIN_ERRORS.invalid)
  })

  it('unlockAccount() (password reset) lifts the lock', async () => {
    await lockAlice()
    await unlockAccount('id-alice')
    expect(await login('alice', RIGHT, '203.0.113.97')).toMatchObject({ id: 'id-alice' })
  })
})

describe('unknown login names', () => {
  it('still run a bcrypt comparison and get the generic error', async () => {
    db.user.findFirst.mockResolvedValueOnce(null)
    const spy = vi.spyOn(bcrypt, 'compare')
    await expect(login('ghost', 'whatever')).rejects.toThrow(LOGIN_ERRORS.invalid)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('session revocation (jwt callback)', () => {
  const jwt = authOptions.callbacks!.jwt!

  it('stamps the sign-in time on new sessions', async () => {
    const token = await jwt({ token: {}, user: { id: 'u1', role: 'USER' } } as never)
    expect(typeof token.authTime).toBe('number')
  })

  it('rejects sessions that started before a password change, keeps newer ones', async () => {
    const changedAt = Date.now()
    await revokeSessions('u1', changedAt)
    await expect(jwt({ token: { id: 'u1', authTime: changedAt - 1000 } } as never)).rejects.toBeInstanceOf(
      SessionRevokedError
    )
    await expect(jwt({ token: { id: 'u1', authTime: changedAt + 1000 } } as never)).resolves.toMatchObject({
      id: 'u1',
    })
  })

  it('sessions from before this feature (no authTime) are revoked by a password change', async () => {
    await revokeSessions('u2')
    await expect(jwt({ token: { id: 'u2' } } as never)).rejects.toBeInstanceOf(SessionRevokedError)
  })

  it('users who never changed their password are unaffected', async () => {
    await expect(jwt({ token: { id: 'u3', authTime: 1 } } as never)).resolves.toMatchObject({ id: 'u3' })
  })
})
