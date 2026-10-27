/**
 * The profile form (PATCH /api/users/me) against real Postgres: name and
 * phone, and an emptied phone is cleared, not kept.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createUser, resetDatabase } from '@/test/integration/fixtures'
import { PATCH } from './route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const patch = (body: unknown) =>
  PATCH(new NextRequest('http://localhost/api/users/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('the profile form', () => {
  it('saves the name and phone, and clears an emptied phone', async () => {
    const user = await createUser()
    mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })

    expect((await patch({ name: 'Nguyễn Văn A', phone: ' 0901234567 ' })).status).toBe(200)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ name: 'Nguyễn Văn A', phone: '0901234567' })

    expect((await patch({ name: 'Nguyễn Văn A', phone: '' })).status).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBeNull()
  })
})
