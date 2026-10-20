/**
 * Who may change a hotel's website (settings, publishing, blocks), against
 * real Postgres: the owner, ADMIN and MANAGER, as for the custom domain and
 * SSL, and as the sidebar shows the builder. Receptionists and USER members
 * could publish or unpublish the site and rewrite it; they can still read it.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { WorkspaceRole } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET as getSettings, PUT as putSettings } from './settings/route'
import { PUT as putBlocks } from './blocks/route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
const req = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })

async function hotelWith(role: WorkspaceRole) {
  const tenant = await createTenant()
  const user = await createUser()
  await prisma.workspaceMember.create({ data: { workspaceId: tenant.workspace.id, userId: user.id, role } })
  return { ...tenant, user }
}

const publish = (propertyId: string) => putSettings(req('/api/website/settings', 'PUT', { propertyId, settings: { isPublished: true } }))
const rewrite = (propertyId: string) =>
  putBlocks(req('/api/website/blocks', 'PUT', { propertyId, blocks: [{ type: 'HERO', name: 'Mới' }] }))

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('website editing roles', () => {
  it.each(['RECEPTIONIST', 'USER'] as const)('a %s member cannot publish or rewrite the site, and can still read it', async (role) => {
    const { property, user } = await hotelWith(role)
    await prisma.websiteBlock.create({ data: { propertyId: property.id, type: 'ABOUT', name: 'Giới thiệu' } })
    signInAs(user)

    expect((await publish(property.id)).status).toBe(403)
    expect((await rewrite(property.id)).status).toBe(403)
    expect(await prisma.websiteSettings.count({ where: { propertyId: property.id, isPublished: true } })).toBe(0)
    expect((await prisma.websiteBlock.findMany({ where: { propertyId: property.id } })).map((b) => b.name)).toEqual(['Giới thiệu'])

    expect((await getSettings(req(`/api/website/settings?propertyId=${property.id}`))).status).toBe(200)
  })

  it.each(['ADMIN', 'MANAGER'] as const)('an %s member publishes and rewrites the site', async (role) => {
    const { property, user } = await hotelWith(role)
    signInAs(user)

    expect((await publish(property.id)).status).toBe(200)
    expect((await rewrite(property.id)).status).toBe(200)
    expect(await prisma.websiteSettings.findUnique({ where: { propertyId: property.id } })).toMatchObject({ isPublished: true })
  })

  it('the owner publishes the site', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    expect((await publish(property.id)).status).toBe(200)
    expect((await rewrite(property.id)).status).toBe(200)
  })
})
