/**
 * Runs against an in-memory fake; set TEST_REDIS_URL to also run against a
 * real Redis (keys use a unique id per test, nothing else is touched).
 */
import { describe, it, expect, vi, afterAll } from 'vitest'
import Redis from 'ioredis'

vi.mock('@/lib/db/redis', () => ({ redis: {} }))

import { clearLimit, hit, isBlocked, recordFailure, tooManyRequests, type Limit, type LimitStore } from './rate-limit'

function fakeStore(): LimitStore {
  const data = new Map<string, string>()
  const ttls = new Map<string, number>()
  return {
    async incr(key) {
      const n = Number(data.get(key) ?? 0) + 1
      data.set(key, String(n))
      return n
    },
    async expire(key, seconds) {
      ttls.set(key, seconds)
      return 1
    },
    async get(key) {
      return data.get(key) ?? null
    },
    async del(key) {
      ttls.delete(key)
      return data.delete(key) ? 1 : 0
    },
    async ttl(key) {
      return ttls.get(key) ?? -1
    },
  }
}

const realRedis = process.env.TEST_REDIS_URL ? new Redis(process.env.TEST_REDIS_URL) : null
afterAll(() => realRedis?.disconnect())

const stores: [string, () => LimitStore][] = [['fake store', fakeStore]]
if (realRedis) stores.push(['real Redis', () => realRedis as unknown as LimitStore])

let n = 0
const uniqueId = () => `t-${Date.now()}-${n++}`
const LIMIT: Limit = { name: 'test', limit: 3, windowSec: 60 }

describe.each(stores)('rate limits on %s', (_name, makeStore) => {
  it('hit(): allows `limit` requests, then refuses with a Retry-After', async () => {
    const store = makeStore()
    const id = uniqueId()
    for (let i = 0; i < LIMIT.limit; i++) expect((await hit(LIMIT, id, store)).allowed).toBe(true)
    const blocked = await hit(LIMIT, id, store)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(LIMIT.windowSec)
  })

  it('counters are per id', async () => {
    const store = makeStore()
    const a = uniqueId()
    for (let i = 0; i <= LIMIT.limit; i++) await hit(LIMIT, a, store)
    expect((await hit(LIMIT, a, store)).allowed).toBe(false)
    expect((await hit(LIMIT, uniqueId(), store)).allowed).toBe(true)
  })

  it('ids are normalized (case, spaces)', async () => {
    const store = makeStore()
    const id = uniqueId()
    for (let i = 0; i < LIMIT.limit; i++) await recordFailure(LIMIT, ` ${id.toUpperCase()} `, store)
    expect((await isBlocked(LIMIT, id, store)).allowed).toBe(false)
  })

  it('failure counters: blocked only after `limit` failures, cleared by clearLimit()', async () => {
    const store = makeStore()
    const id = uniqueId()
    for (let i = 0; i < LIMIT.limit - 1; i++) await recordFailure(LIMIT, id, store)
    expect((await isBlocked(LIMIT, id, store)).allowed).toBe(true)
    await recordFailure(LIMIT, id, store)
    expect((await isBlocked(LIMIT, id, store)).allowed).toBe(false)
    await clearLimit(LIMIT, id, store)
    expect((await isBlocked(LIMIT, id, store)).allowed).toBe(true)
  })

  it('parallel requests cannot exceed the limit', async () => {
    const store = makeStore()
    const id = uniqueId()
    const results = await Promise.all(Array.from({ length: 20 }, () => hit(LIMIT, id, store)))
    expect(results.filter((r) => r.allowed)).toHaveLength(LIMIT.limit)
  })
})

describe('fail-open', () => {
  it('allows the request and logs when Redis errors', async () => {
    const broken: LimitStore = {
      incr: () => Promise.reject(new Error('ECONNREFUSED')),
      expire: () => Promise.reject(new Error('ECONNREFUSED')),
      get: () => Promise.reject(new Error('ECONNREFUSED')),
      del: () => Promise.reject(new Error('ECONNREFUSED')),
      ttl: () => Promise.reject(new Error('ECONNREFUSED')),
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await hit(LIMIT, 'x', broken)).allowed).toBe(true)
    expect((await isBlocked(LIMIT, 'x', broken)).allowed).toBe(true)
    expect(await recordFailure(LIMIT, 'x', broken)).toBe(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('tooManyRequests', () => {
  it('returns 429 with Retry-After', async () => {
    const res = tooManyRequests('Chậm lại', 42)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('42')
    expect(await res.json()).toMatchObject({ success: false, error: 'Chậm lại', retryAfterSec: 42 })
  })
})
