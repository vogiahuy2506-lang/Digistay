/**
 * A change beyond the plan, through the real routes against real Postgres:
 * the 403 keeps its message and code, and carries the facts the dashboard's
 * upgrade prompt shows (src/components/billing/plan-limit-prompt.tsx): what
 * is used, the limit, the plan in force and the cheapest plan that fits.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
// No request scope here: emails stay queued in the outbox.
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: () => {} }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createRoomType, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import type { PlanId } from '@/lib/marketing/plans'
import { POST as createProperty } from '@/app/api/properties/route'
import { POST as createRoomTypeRoute } from '@/app/api/properties/[id]/room-types/route'
import { POST as invite } from '@/app/api/workspaces/[id]/invitations/route'

const DAY = 86_400_000

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const at = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body: unknown) =>
  new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

/** The workspace on a paid monthly `plan` (not a trial) for the next 30 days. */
async function onPlan(workspaceId: string, plan: PlanId) {
  const now = new Date()
  const period = { plan, billing: 'MONTH' as const, trial: false, periodStart: now, periodEnd: new Date(now.getTime() + 30 * DAY) }
  await prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...period }, update: period })
}

beforeEach(async () => {
  await resetDatabase()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(() => prisma.$disconnect())

describe('a change beyond the plan', () => {
  it('a second property on Starter: the message and code as before, and the facts suggesting Growth', async () => {
    const t = await createTenant()
    await onPlan(t.workspace.id, 'starter')
    signInAs(t.owner)
    const res = await createProperty(
      post({ workspaceId: t.workspace.id, name: 'Second Hotel', type: 'HOTEL', address: '2 Test Street', city: 'Hue', subdomain: `second-${Date.now()}` }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      success: false,
      error: 'Gói hiện tại cho phép tối đa 1 cơ sở. Nâng cấp gói trong Gói & thanh toán để thêm.',
      code: 'PLAN_LIMIT',
      limit: { kind: 'properties', used: 1, limit: 1, adding: 1, plan: 'starter', suggested: 'growth' },
    })
    expect(await prisma.property.count({ where: { workspaceId: t.workspace.id } })).toBe(1)
  })

  it('a staff invitation past Growth’s 10 seats suggests Business', async () => {
    const t = await createTenant()
    await onPlan(t.workspace.id, 'growth')
    for (let i = 0; i < 10; i++) {
      const user = await createUser()
      await prisma.workspaceMember.create({ data: { workspaceId: t.workspace.id, userId: user.id, role: 'RECEPTIONIST' } })
    }
    signInAs(t.owner)
    const res = await invite(post({ email: 'one-more@example.com', role: 'RECEPTIONIST' }), at(t.workspace.id))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toMatchObject({ code: 'PLAN_LIMIT', error: expect.stringMatching(/tối đa 10 tài khoản nhân viên/) })
    expect(body.limit).toEqual({ kind: 'staff', used: 10, limit: 10, adding: 1, plan: 'growth', suggested: 'business' })
  })

  it('a room type no plan has room for: how many it adds, and no suggestion', async () => {
    const t = await createTenant()
    await onPlan(t.workspace.id, 'business')
    await createRoomType(t.property.id, { totalRooms: 295 })
    signInAs(t.owner)
    const res = await createRoomTypeRoute(
      post({ name: 'Suite', bedType: 'DOUBLE', maxAdults: 2, maxChildren: 0, totalRooms: 12, maxOccupancy: 2 }),
      at(t.property.id),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).limit).toEqual({ kind: 'rooms', used: 295, limit: 300, adding: 12, plan: 'business', suggested: null })
  })
})
