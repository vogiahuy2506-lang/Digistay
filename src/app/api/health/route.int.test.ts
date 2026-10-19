import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { GET } from './route'

afterAll(() => prisma.$disconnect())

describe('GET /api/health (Postgres)', () => {
  it('returns ok against a real database', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ok')
  })
})
