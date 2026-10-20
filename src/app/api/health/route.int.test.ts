import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { GET } from './route'

const keys = process.env.DATA_ENCRYPTION_KEYS

afterEach(() => {
  if (keys === undefined) delete process.env.DATA_ENCRYPTION_KEYS
  else process.env.DATA_ENCRYPTION_KEYS = keys
  vi.restoreAllMocks()
})
afterAll(() => prisma.$disconnect())

describe('GET /api/health (Postgres)', () => {
  it('returns ok against a real database', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ok')
  })

  it.each([
    ['malformed', '1:CHANGE_ME'],
    ['missing', undefined],
  ])('fails while DATA_ENCRYPTION_KEYS is %s, without saying why', async (_, value) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    if (value === undefined) delete process.env.DATA_ENCRYPTION_KEYS
    else process.env.DATA_ENCRYPTION_KEYS = value
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error', version: expect.any(String) })
  })
})
