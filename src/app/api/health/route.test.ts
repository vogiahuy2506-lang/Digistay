import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { $queryRaw: vi.fn() },
}))

import { prisma } from '@/lib/db'
import { GET, dynamic } from './route'

const mockQueryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('APP_VERSION', 'abc123')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/health', () => {
  it('is never statically rendered', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('returns ok with the image version when the database answers', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ status: 'ok', version: 'abc123' })
  })

  it('returns 503 without error details when the database is down', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', version: 'abc123' })
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|password/)
    spy.mockRestore()
  })

  it('reports "dev" when no version was baked in', async () => {
    vi.stubEnv('APP_VERSION', '')
    mockQueryRaw.mockResolvedValueOnce([])
    expect((await (await GET()).json()).version).toBe('dev')
  })
})
