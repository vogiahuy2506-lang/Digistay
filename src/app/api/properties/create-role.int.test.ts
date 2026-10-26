/** Who may add a property to a workspace: owners, admins and managers, not receptionists or staff. */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'
import { POST as createProperty } from './route'

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

const create = (workspaceId: string) =>
  createProperty(
    new NextRequest('http://digistay.test/api/properties', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, name: `Cơ sở ${Date.now()}`, type: 'HOTEL', address: '9 Test Street', city: 'Hue', subdomain: `co-so-${Date.now()}` }),
    }),
  )

beforeEach(async () => {
  await resetDatabase()
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/properties', () => {
  it('refuses receptionists and staff', async () => {
    for (const role of ['RECEPTIONIST', 'USER'] as const) {
      const t = await createTenant({ memberRole: role })
      signInAs(t.member!)
      expect((await create(t.workspace.id)).status).toBe(403)
    }
  })

  it('lets a manager add one', async () => {
    const t = await createTenant({ memberRole: 'MANAGER' })
    signInAs(t.member!)
    expect((await create(t.workspace.id)).status).toBe(200)
  })
})
