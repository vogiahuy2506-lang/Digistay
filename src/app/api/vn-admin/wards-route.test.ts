/** GET /api/vn-admin/provinces/[code]/wards: one province's wards for the address pickers. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { GET } from './provinces/[code]/wards/route'

const get = (code: string) =>
  GET(new NextRequest(`http://localhost/api/vn-admin/provinces/${code}/wards`), { params: Promise.resolve({ code }) })

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'a@example.com' } } as never)
})

describe('GET /api/vn-admin/provinces/[code]/wards', () => {
  it("answers the province's wards, cacheable by the browser", async () => {
    const res = await get('48')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, max-age=86400')
    const body = await res.json()
    expect(body.data).toContainEqual({ code: '20410', name: 'Phường Hội An' })
    expect(body.data.every((w: { code: string; name: string }) => /^\d{5}$/.test(w.code) && w.name)).toBe(true)
  })

  it('404s an unknown province', async () => {
    expect((await get('99')).status).toBe(404)
  })

  it('needs a signed-in user', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    expect((await get('48')).status).toBe(401)
  })
})
