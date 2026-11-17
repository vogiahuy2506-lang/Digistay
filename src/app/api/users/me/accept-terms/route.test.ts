import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST } from './route'

describe('POST /api/users/me/accept-terms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    vi.mocked(auth).mockResolvedValue(null as any)

    const res = await POST()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ success: false, error: 'Vui lòng đăng nhập' })
  })

  it('updates termsAcceptedAt for the authenticated user and returns success', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'usr-123', email: 'test@example.com' },
    } as any)

    const now = new Date()
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'usr-123',
      termsAcceptedAt: now,
    } as any)

    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('usr-123')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'usr-123' },
      data: { termsAcceptedAt: expect.any(Date) },
      select: { id: true, termsAcceptedAt: true },
    })
  })
})
