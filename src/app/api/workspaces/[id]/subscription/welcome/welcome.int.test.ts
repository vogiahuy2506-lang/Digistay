/**
 * The free trial's welcome against real Postgres: the owner marks it seen
 * once (POST …/subscription/welcome), and it is not offered again; staff
 * cannot dismiss it for the owner.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'
import { workspacePlan } from '@/lib/billing/subscription'
import { welcomesTrial } from '@/lib/billing/period'
import { POST } from './route'

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const dismiss = (workspaceId: string) =>
  POST(new NextRequest(`http://localhost/api/workspaces/${workspaceId}/subscription/welcome`, { method: 'POST' }), {
    params: Promise.resolve({ id: workspaceId }),
  })
const offered = async (workspaceId: string, isOwner: boolean) => {
  const plan = await workspacePlan(workspaceId)
  return welcomesTrial(plan.subscription, plan.state, isOwner)
}

describe('trial welcome', () => {
  it('is offered to the owner of a new workspace until they close it', async () => {
    const { owner, workspace } = await createTenant()
    expect(await offered(workspace.id, true)).toBe(true)

    signInAs(owner)
    expect((await dismiss(workspace.id)).status).toBe(200)
    const seen = (await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: workspace.id } })).trialWelcomedAt
    expect(seen).toBeInstanceOf(Date)
    expect(await offered(workspace.id, true)).toBe(false)

    // Again: the first time is kept.
    expect((await dismiss(workspace.id)).status).toBe(200)
    expect((await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: workspace.id } })).trialWelcomedAt).toEqual(seen)
  })

  it('cannot be closed for the owner by staff, nor by outsiders', async () => {
    const { workspace, member } = await createTenant({ memberRole: 'ADMIN' })
    const other = await createTenant()
    signInAs(member!)
    expect((await dismiss(workspace.id)).status).toBe(403)
    signInAs(other.owner)
    expect((await dismiss(workspace.id)).status).toBe(403)
    expect(await offered(workspace.id, true)).toBe(true)
  })
})
