/**
 * Account emails come in the language of the page that triggered them: the
 * NEXT_LOCALE cookie, Vietnamese without one. The sign-up code route is run
 * for real against an in-memory Redis; Prisma and email are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const data = new Map<string, string>()
  const redis = {
    async set(key: string, value: string, _mode?: string, _ttl?: number, flag?: string) {
      if (flag === 'NX' && data.has(key)) return null
      data.set(key, value)
      return 'OK'
    },
    get: async (key: string) => data.get(key) ?? null,
    del: async (key: string) => (data.delete(key) ? 1 : 0),
    async incr(key: string) {
      const n = Number(data.get(key) ?? 0) + 1
      data.set(key, String(n))
      return n
    },
    expire: async () => 1,
    ttl: async () => 300,
  }
  return { data, redis }
})
vi.mock('@/lib/db/redis', () => ({ redis: h.redis }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findFirst: vi.fn(async () => null) } } }))
vi.mock('@/lib/email', () => ({ sendOtpEmail: vi.fn(async () => ({ success: true, sent: true })) }))

import { sendOtpEmail } from '@/lib/email'
import { POST as sendOtp } from '@/app/api/auth/otp/send/route'
import { requestLocale } from './request-locale'

const request = (cookie?: string) =>
  new NextRequest('http://localhost/api/auth/otp/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
    body: JSON.stringify({ email: `new${Math.random()}@example.com`, purpose: 'register' }),
  })

beforeEach(() => {
  h.data.clear()
  vi.clearAllMocks()
})

describe('requestLocale', () => {
  it("is the visitor's NEXT_LOCALE, Vietnamese otherwise", () => {
    expect(requestLocale(request('NEXT_LOCALE=en'))).toBe('en')
    expect(requestLocale(request('NEXT_LOCALE=vi'))).toBe('vi')
    expect(requestLocale(request('NEXT_LOCALE=fr'))).toBe('vi')
    expect(requestLocale(request('other=en'))).toBe('vi')
    expect(requestLocale(request())).toBe('vi')
  })

  it('the sign-up code is sent in the language of the page that asked for it', async () => {
    expect((await sendOtp(request('NEXT_LOCALE=en'))).status).toBe(200)
    expect((await sendOtp(request())).status).toBe(200)
    expect(vi.mocked(sendOtpEmail).mock.calls.map(([data]) => data.locale)).toEqual(['en', 'vi'])
  })
})
