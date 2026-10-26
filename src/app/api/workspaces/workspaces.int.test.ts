/**
 * Creating and renaming a workspace, against real Postgres, with the bodies
 * the pages send. The create dialog sent `logo: null` (no logo uploaded) and
 * the settings page `domain: null`; both were refused with zod's English
 * "Invalid input", so no workspace could be made or renamed without a logo.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { POST as createWorkspace } from './route'
import { PATCH as updateWorkspace } from './[id]/route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string | null }) =>
  mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('POST /api/workspaces', () => {
  it('creates a workspace without a logo (logo and domain null)', async () => {
    const user = await createUser()
    signInAs(user)

    const res = await createWorkspace(
      req('/api/workspaces', 'POST', {
        name: 'QA Chuỗi Khách Sạn',
        slug: 'qa-chuoi-khach-san',
        description: '',
        logo: null,
        domain: null,
        businessType: 'resort',
        currency: 'VND',
        timezone: 'GMT+07:00',
      })
    )
    expect(res.status).toBe(200)

    const saved = await prisma.workspace.findUniqueOrThrow({ where: { slug: 'qa-chuoi-khach-san' } })
    expect(saved).toMatchObject({ name: 'QA Chuỗi Khách Sạn', ownerId: user.id, logo: null, domain: null })
    expect(saved.settings).toMatchObject({ businessType: 'resort', currency: 'VND', timezone: 'GMT+07:00' })
  })

  it('answers a malformed field in Vietnamese, not with zod’s English', async () => {
    signInAs(await createUser())
    const res = await createWorkspace(req('/api/workspaces', 'POST', { name: 'Tên hợp lệ', logo: 42 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Dữ liệu không hợp lệ')
  })
})

describe('PATCH /api/workspaces/[id]', () => {
  it('renames a workspace that has no logo, from the edit dialog and from the settings page', async () => {
    const { owner, workspace } = await createTenant()
    signInAs(owner)

    // The edit dialog on /workspaces.
    let res = await updateWorkspace(
      req(`/api/workspaces/${workspace.id}`, 'PATCH', { name: 'Tên mới', description: '', logo: null }),
      params(workspace.id)
    )
    expect(res.status).toBe(200)

    // The settings page, with the regional settings in the same request.
    res = await updateWorkspace(
      req(`/api/workspaces/${workspace.id}`, 'PATCH', {
        name: 'Tên mới hơn',
        description: 'Mô tả',
        logo: null,
        domain: null,
        businessType: 'homestay',
        currency: 'USD',
        timezone: 'GMT+08:00',
      }),
      params(workspace.id)
    )
    expect(res.status).toBe(200)

    const saved = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
    expect(saved).toMatchObject({ name: 'Tên mới hơn', description: 'Mô tả', logo: null, domain: null })
    expect(saved.settings).toMatchObject({ businessType: 'homestay', currency: 'USD', timezone: 'GMT+08:00' })
  })

  it('removes the logo with null and keeps the other settings keys when changing one', async () => {
    const { owner, workspace } = await createTenant()
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { logo: 'https://res.cloudinary.com/demo/logo.png', settings: { currency: 'VND', notifications: { email: true } } },
    })
    signInAs(owner)

    const res = await updateWorkspace(
      req(`/api/workspaces/${workspace.id}`, 'PATCH', { logo: null, timezone: 'GMT+09:00' }),
      params(workspace.id)
    )
    expect(res.status).toBe(200)

    const saved = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
    expect(saved.logo).toBeNull()
    expect(saved.settings).toEqual({ currency: 'VND', notifications: { email: true }, timezone: 'GMT+09:00' })
  })

  it('still refuses a member who is not an admin', async () => {
    const { workspace, member } = await createTenant({ memberRole: 'MANAGER' })
    signInAs(member!)
    const res = await updateWorkspace(
      req(`/api/workspaces/${workspace.id}`, 'PATCH', { name: 'Không được', logo: null }),
      params(workspace.id)
    )
    expect(res.status).toBe(403)
    expect((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).name).toBe(workspace.name)
  })
})
