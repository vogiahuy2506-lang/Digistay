import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { inheritedOrTrialFields, trialFields } from '@/lib/billing/subscription'
import { setUserPlan } from '@/lib/admin/users'
import { POST as userPlanRoute } from '@/app/api/admin/users/[userId]/plan/route'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>

const DAY = 86_400_000

describe('User-level plan assignment and inheritance', () => {
  beforeEach(async () => {
    await resetDatabase()
    vi.clearAllMocks()
  })

  it('inheritedOrTrialFields returns trial fields for new user without active plan', async () => {
    const user = await createUser('newuser@digistay.vn')
    const fields = await inheritedOrTrialFields(user.id, prisma)
    expect(fields.trial).toBe(true)
    expect(fields.plan).toBe('growth') // default TRIAL_PLAN
  })

  it('inheritedOrTrialFields inherits active plan when owner has an active subscription', async () => {
    const { owner, workspace } = await createTenant()

    const futureEnd = new Date(Date.now() + 180 * DAY)
    await prisma.subscription.update({
      where: { workspaceId: workspace.id },
      data: {
        plan: 'business',
        trial: false,
        billing: 'YEAR',
        periodEnd: futureEnd,
      },
    })

    const fields = await inheritedOrTrialFields(owner.id, prisma)
    expect(fields.trial).toBe(false)
    expect(fields.plan).toBe('business')
    expect(fields.billing).toBe('YEAR')
    expect(fields.periodEnd.getTime()).toBe(futureEnd.getTime())
  })

  it('setUserPlan propagates plan to all workspaces owned by the user', async () => {
    const adminUser = await createUser('admin@digistay.vn')
    await prisma.user.update({ where: { id: adminUser.id }, data: { role: 'SUPER_ADMIN' } })

    const { owner, workspace: ws1 } = await createTenant()
    const ws2 = await prisma.workspace.create({
      data: {
        name: 'Second Resort',
        slug: 'second-resort',
        ownerId: owner.id,
        subscription: { create: trialFields() },
      },
    })

    const targetEnd = new Date(Date.now() + 90 * DAY)
    const result = await setUserPlan(
      { id: adminUser.id, email: adminUser.email, name: adminUser.name },
      owner.id,
      {
        plan: 'growth',
        trial: false,
        periodEnd: targetEnd,
        note: 'Tặng gói khách hàng thân thiết',
      }
    )

    expect(result).not.toBeNull()
    expect(result?.plan).toBe('growth')
    expect(result?.trial).toBe(false)

    const sub1 = await prisma.subscription.findUnique({ where: { workspaceId: ws1.id } })
    const sub2 = await prisma.subscription.findUnique({ where: { workspaceId: ws2.id } })

    expect(sub1?.plan).toBe('growth')
    expect(sub1?.trial).toBe(false)
    expect(sub1?.periodEnd.getTime()).toBe(targetEnd.getTime())

    expect(sub2?.plan).toBe('growth')
    expect(sub2?.trial).toBe(false)
    expect(sub2?.periodEnd.getTime()).toBe(targetEnd.getTime())
  })

  it('setUserPlan creates default workspace if user has no workspaces yet', async () => {
    const adminUser = await createUser('admin2@digistay.vn')
    await prisma.user.update({ where: { id: adminUser.id }, data: { role: 'SUPER_ADMIN' } })
    const freshUser = await createUser('fresh@digistay.vn')

    const targetEnd = new Date(Date.now() + 365 * DAY)
    const result = await setUserPlan(
      { id: adminUser.id, email: adminUser.email, name: adminUser.name },
      freshUser.id,
      {
        plan: 'starter',
        trial: false,
        periodEnd: targetEnd,
        note: 'Cấp gói trước khi tạo workspace',
      }
    )

    expect(result?.plan).toBe('starter')
    expect(result?.trial).toBe(false)

    const userWorkspaces = await prisma.workspace.findMany({
      where: { ownerId: freshUser.id },
      include: { subscription: true },
    })

    expect(userWorkspaces.length).toBe(1)
    expect(userWorkspaces[0].subscription?.plan).toBe('starter')
    expect(userWorkspaces[0].subscription?.trial).toBe(false)
  })

  it('POST /api/admin/users/[userId]/plan handles requests from super admin', async () => {
    const adminUser = await createUser('super@digistay.vn')
    await prisma.user.update({ where: { id: adminUser.id }, data: { role: 'SUPER_ADMIN' } })
    const { owner, workspace } = await createTenant()

    mockAuth.mockResolvedValue({ user: { id: adminUser.id, email: adminUser.email, role: 'SUPER_ADMIN' } })

    const futureDay = new Date(Date.now() + 60 * DAY).toISOString().slice(0, 10)
    const req = new NextRequest('http://localhost/api/admin/users/' + owner.id + '/plan', {
      method: 'POST',
      body: JSON.stringify({
        plan: 'business',
        trial: false,
        periodEnd: futureDay,
        note: 'Cấp gói business 60 ngày',
      }),
    })

    const res = await userPlanRoute(req, { params: Promise.resolve({ userId: owner.id }) })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.plan).toBe('business')

    const sub = await prisma.subscription.findUnique({ where: { workspaceId: workspace.id } })
    expect(sub?.plan).toBe('business')
  })
})
