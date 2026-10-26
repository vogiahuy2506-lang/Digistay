/**
 * A locked workspace (7 days past the end of its period) against real
 * Postgres: changes are refused with 402 after the route's own permission
 * check, reading still works, and the same change goes through once the
 * period is paid again.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET as getPolicy, PATCH as patchPolicy } from '@/app/api/properties/[id]/policy/route'
import { WORKSPACE_LOCKED, lockedResponse, lockedResponseForProperty } from './guard'

const DAY = 86_400_000

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const at = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/properties/x/policy', {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })

/** The workspace's paid period ends at `periodEnd` (not a trial). */
const periodEndsAt = (workspaceId: string, periodEnd: Date) =>
  prisma.subscription.upsert({
    where: { workspaceId },
    create: { workspaceId, plan: 'growth', billing: 'MONTH', trial: false, periodStart: new Date(periodEnd.getTime() - 30 * DAY), periodEnd },
    update: { trial: false, periodStart: new Date(periodEnd.getTime() - 30 * DAY), periodEnd },
  })

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('a locked workspace', () => {
  it('is refused with 402 by the guard', async () => {
    const { workspace, property } = await createTenant()
    await periodEndsAt(workspace.id, new Date(Date.now() - 8 * DAY))

    const locked = await lockedResponse(workspace.id)
    expect(locked?.status).toBe(402)
    expect(await locked?.json()).toMatchObject({ success: false, error: WORKSPACE_LOCKED, code: 'WORKSPACE_LOCKED' })
    expect((await lockedResponseForProperty(property.id))?.status).toBe(402)
    expect(await lockedResponseForProperty('no-such-property')).toBeNull()
  })

  it('cannot change its data through a route, but still reads it; outsiders still get 403', async () => {
    const { owner, workspace, property } = await createTenant()
    await prisma.policy.create({ data: { propertyId: property.id, checkInTime: '14:00' } })
    await periodEndsAt(workspace.id, new Date(Date.now() - 8 * DAY))

    signInAs(await createUser())
    expect((await patchPolicy(req('PATCH', { checkInTime: '15:00' }), at(property.id))).status).toBe(403)

    signInAs(owner)
    const res = await patchPolicy(req('PATCH', { checkInTime: '15:00' }), at(property.id))
    expect(res.status).toBe(402)
    expect((await res.json()).code).toBe('WORKSPACE_LOCKED')
    expect((await prisma.policy.findUniqueOrThrow({ where: { propertyId: property.id } })).checkInTime).toBe('14:00')

    const read = await getPolicy(req('GET'), at(property.id))
    expect(read.status).toBe(200)
  })

  it('changes it again once the period is paid', async () => {
    const { owner, workspace, property } = await createTenant()
    await periodEndsAt(workspace.id, new Date(Date.now() + 20 * DAY))
    expect(await lockedResponse(workspace.id)).toBeNull()

    signInAs(owner)
    const res = await patchPolicy(req('PATCH', { checkInTime: '15:00' }), at(property.id))
    expect(res.status).toBe(200)
    expect((await prisma.policy.findUniqueOrThrow({ where: { propertyId: property.id } })).checkInTime).toBe('15:00')
  })
})
