/**
 * The operators' customers page against real Postgres (/admin/customers,
 * src/lib/admin): only a SUPER_ADMIN gets in; workspaces listed by plan
 * state with their usage; a plan set by hand and logged; accounts locked
 * out of every sign-in and back; two-factor turned off with how the person
 * was verified. Redis is an in-memory fake, so session revocation is real.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'

const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
      async get(key: string) {
        return data.get(key) ?? null
      },
      async set(key: string, value: string) {
        data.set(key, value)
        return 'OK'
      },
      async del(key: string) {
        return data.delete(key) ? 1 : 0
      },
      async incr(key: string) {
        const n = Number(data.get(key) ?? 0) + 1
        data.set(key, String(n))
        return n
      },
      async expire() {
        return 1
      },
      async ttl() {
        return 600
      },
    },
  }
})
vi.mock('@/lib/db/redis', () => ({ redis: store.redis }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { authorizeWithPassword } from '@/lib/auth/credentials'
import { googleSignInGate } from '@/lib/auth/two-factor-login'
import { LOGIN_ERRORS } from '@/lib/auth/error-messages'
import { isSessionRevoked } from '@/lib/auth/session-revocation'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET as listRoute } from '@/app/api/admin/customers/route'
import { GET as detailRoute } from '@/app/api/admin/customers/[workspaceId]/route'
import { POST as planRoute } from '@/app/api/admin/customers/[workspaceId]/plan/route'
import { GET as usersRoute } from '@/app/api/admin/users/route'
import { PATCH as lockRoute } from '@/app/api/admin/users/[userId]/route'
import { DELETE as twoFactorRoute } from '@/app/api/admin/users/[userId]/two-factor/route'

const DAY = 86_400_000
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
const req = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
const json = async (res: Response) => ({ status: res.status, body: await res.json() })
const wsParams = (workspaceId: string) => ({ params: Promise.resolve({ workspaceId }) })
const userParams = (userId: string) => ({ params: Promise.resolve({ userId }) })
/** "YYYY-MM-DD" in Vietnam time, `days` from now. */
const vnDay = (days: number) => new Date(Date.now() + days * DAY + 7 * 3600_000).toISOString().slice(0, 10)

/** The workspace's plan row (createTenant makes none: it is made on first read). */
function setSub(workspaceId: string, data: Omit<Prisma.SubscriptionUncheckedCreateInput, 'workspaceId' | 'plan' | 'periodStart' | 'periodEnd'> & { plan?: string; periodStart?: Date; periodEnd: Date }) {
  const row = { plan: 'growth', periodStart: new Date(), ...data }
  return prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...row }, update: row })
}

async function operator() {
  const user = await createUser('ops@digistay.vn')
  return prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } })
}

beforeEach(async () => {
  store.data.clear()
  await resetDatabase()
})
afterAll(() => prisma.$disconnect())

describe('who gets in', () => {
  it('answers 401 signed out, 404 to anyone but an operator, and to a locked operator', async () => {
    const { owner } = await createTenant()
    mockAuth.mockResolvedValue(null)
    expect((await listRoute(req('/api/admin/customers'))).status).toBe(401)
    signInAs(owner)
    expect((await listRoute(req('/api/admin/customers'))).status).toBe(404)
    // The token's role does not count: the database's does.
    mockAuth.mockResolvedValue({ user: { id: owner.id, email: owner.email, role: 'SUPER_ADMIN' } })
    expect((await usersRoute(req('/api/admin/users'))).status).toBe(404)

    const ops = await operator()
    signInAs(ops)
    expect((await listRoute(req('/api/admin/customers'))).status).toBe(200)
    await prisma.user.update({ where: { id: ops.id }, data: { disabledAt: new Date() } })
    expect((await listRoute(req('/api/admin/customers'))).status).toBe(404)
  })
})

describe('the customers list', () => {
  it('lists workspaces by state and search, with their usage and the figures', async () => {
    const trial = await createTenant()
    const paid = await createTenant()
    const overdue = await createTenant()
    const locked = await createTenant()
    const now = Date.now()
    await setSub(trial.workspace.id, { trial: true, periodEnd: new Date(now + 5 * DAY) })
    await setSub(paid.workspace.id, { trial: false, plan: 'business', billing: 'YEAR', periodEnd: new Date(now + 200 * DAY) })
    await setSub(overdue.workspace.id, { trial: false, periodEnd: new Date(now - 2 * DAY) })
    await setSub(locked.workspace.id, { trial: false, periodEnd: new Date(now - 30 * DAY) })
    signInAs(await operator())

    const all = await json(await listRoute(req('/api/admin/customers')))
    expect(all.body.data.total).toBe(4)
    expect(all.body.data.summary.byState).toEqual({ trial: 1, active: 1, grace: 1, locked: 1 })
    expect(all.body.data.summary.paidByPlan).toEqual({ business: 1 })
    const row = all.body.data.rows.find((r: { id: string }) => r.id === paid.workspace.id)
    expect(row).toMatchObject({ plan: { plan: 'business', billing: 'YEAR', state: 'active' }, usage: { properties: 1 }, limits: { properties: 10 } })

    const ids = async (query: string) => (await json(await listRoute(req(`/api/admin/customers?${query}`)))).body.data.rows.map((r: { id: string }) => r.id)
    expect(await ids('state=grace')).toEqual([overdue.workspace.id])
    expect(await ids('state=locked')).toEqual([locked.workspace.id])
    expect(await ids(`q=${encodeURIComponent(paid.owner.email.toUpperCase())}`)).toEqual([paid.workspace.id])
    expect((await listRoute(req('/api/admin/customers?state=nope'))).status).toBe(400)
  })

  it('shows one workspace with its owner, staff, properties and plan orders', async () => {
    const { workspace, owner, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    await prisma.subscriptionPayment.create({ data: { workspaceId: workspace.id, plan: 'growth', billing: 'MONTH', amount: 5000, orderCode: '990001', status: 'PAID', paidAt: new Date() } })
    signInAs(await operator())
    const detail = await json(await detailRoute(req('/x'), wsParams(workspace.id)))
    expect(detail.status).toBe(200)
    expect(detail.body.data.owner).toMatchObject({ id: owner.id, twoFactor: false })
    expect(detail.body.data.members).toEqual([expect.objectContaining({ role: 'RECEPTIONIST', user: expect.objectContaining({ id: member!.id }) })])
    expect(detail.body.data.properties).toHaveLength(1)
    expect(detail.body.data.payments).toEqual([expect.objectContaining({ orderCode: '990001', status: 'PAID' })])
    expect((await detailRoute(req('/x'), wsParams('nope'))).status).toBe(404)
  })
})

describe('setting a plan by hand', () => {
  it('extends the same plan, gives another from now, and logs who did it and why', async () => {
    const { workspace } = await createTenant()
    const start = new Date(Date.now() - 3 * DAY)
    await setSub(workspace.id, { plan: 'growth', trial: true, billing: null, periodStart: start, periodEnd: new Date(Date.now() + 2 * DAY) })
    const ops = await operator()
    signInAs(ops)
    const set = (body: unknown) => planRoute(req('/x', 'POST', body), wsParams(workspace.id))

    expect((await set({ plan: 'growth', trial: true, periodEnd: vnDay(9), note: '' })).status).toBe(400)
    expect((await set({ plan: 'growth', trial: true, periodEnd: vnDay(-1), note: 'Khách xin thêm' })).status).toBe(400)

    // A longer trial: same plan, the start kept, the end at the day's end in Vietnam.
    expect((await set({ plan: 'growth', trial: true, periodEnd: vnDay(9), note: 'Khách xin thêm 7 ngày dùng thử' })).status).toBe(200)
    let sub = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: workspace.id } })
    expect(sub).toMatchObject({ plan: 'growth', trial: true, billing: null, periodStart: start })
    expect(sub.periodEnd.toISOString()).toBe(`${vnDay(9)}T16:59:59.999Z`)

    // A plan given: another plan, from now, monthly, no longer a trial.
    expect((await set({ plan: 'business', trial: false, periodEnd: vnDay(90), note: 'Đối tác: tặng 3 tháng' })).status).toBe(200)
    sub = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: workspace.id } })
    expect(sub).toMatchObject({ plan: 'business', trial: false, billing: 'MONTH' })
    expect(sub.periodStart.getTime()).toBeGreaterThan(start.getTime())

    const logs = await prisma.activityLog.findMany({ where: { action: 'PLAN_SET_BY_OPERATOR' }, orderBy: { createdAt: 'asc' } })
    expect(logs).toHaveLength(2)
    expect(logs[1]).toMatchObject({ userId: ops.id, workspaceId: workspace.id, entityType: 'SUBSCRIPTION', metadata: { by: 'ops@digistay.vn', note: 'Đối tác: tặng 3 tháng' } })
    expect(logs[1].changes).toMatchObject({ before: { plan: 'growth', trial: true }, after: { plan: 'business', trial: false } })
  })

  it('moves a paid downgrade waiting with the new end', async () => {
    const { workspace } = await createTenant()
    const end = new Date(Date.now() + 10 * DAY)
    const nextEnd = new Date(end.getTime() + 30 * DAY)
    const waiting = await prisma.subscriptionPayment.create({
      data: { workspaceId: workspace.id, plan: 'starter', billing: 'MONTH', amount: 2000, orderCode: '990002', status: 'PAID', periodStart: end, periodEnd: nextEnd },
    })
    await setSub(workspace.id, { plan: 'business', trial: false, billing: 'MONTH', periodEnd: end, nextPlan: 'starter', nextBilling: 'MONTH', nextPeriodEnd: nextEnd, nextPaymentId: waiting.id })
    signInAs(await operator())
    expect((await planRoute(req('/x', 'POST', { plan: 'business', trial: false, periodEnd: vnDay(17), note: 'Bù 7 ngày sự cố' }), wsParams(workspace.id))).status).toBe(200)
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: workspace.id } })
    const shift = sub.periodEnd.getTime() - end.getTime()
    expect(sub.nextPeriodEnd!.getTime()).toBe(nextEnd.getTime() + shift)
    expect(await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: waiting.id } })).toMatchObject({ periodStart: sub.periodEnd, periodEnd: sub.nextPeriodEnd })
  })
})

describe('accounts', () => {
  async function withPassword(email: string) {
    const user = await createUser(email)
    return prisma.user.update({
      where: { id: user.id },
      data: { username: email.split('@')[0].replace(/\W/g, '_'), password: await bcrypt.hash('Matkhau123!', 4), emailVerified: new Date() },
    })
  }

  it('locks an account out of every sign-in and ends its sessions, then lets it back', async () => {
    const user = await withPassword('khoa@example.com')
    const ops = await operator()
    signInAs(ops)
    const lock = (body: unknown) => lockRoute(req('/x', 'PATCH', body), userParams(user.id))

    expect((await lock({ locked: true, note: '' })).status).toBe(400)
    const signedInAt = Date.now() - 1000
    expect((await lock({ locked: true, note: 'Chủ khách sạn báo mất điện thoại' })).status).toBe(200)
    expect((await lock({ locked: true, note: 'Lần nữa' })).status).toBe(409)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ disabledReason: 'Chủ khách sạn báo mất điện thoại' })

    await expect(authorizeWithPassword({ username: 'khoa@example.com', password: 'Matkhau123!' }, {})).rejects.toThrow(LOGIN_ERRORS.disabled)
    // A wrong password still says only that: the lock shows to the right password only.
    await expect(authorizeWithPassword({ username: 'khoa@example.com', password: 'sai' }, {})).rejects.toThrow(LOGIN_ERRORS.invalid)
    expect(await googleSignInGate({ provider: 'google', providerAccountId: 'g-1' }, 'khoa@example.com')).toBe('/login?error=AccountDisabled')
    expect(await isSessionRevoked(user.id, signedInAt)).toBe(true)

    const locked = await json(await usersRoute(req('/api/admin/users?locked=1')))
    expect(locked.body.data.rows.map((u: { id: string }) => u.id)).toEqual([user.id])

    expect((await lock({ locked: false, note: 'Đã xác minh lại chủ tài khoản' })).status).toBe(200)
    await expect(authorizeWithPassword({ username: 'khoa@example.com', password: 'Matkhau123!' }, {})).resolves.toMatchObject({ id: user.id })
    expect(await prisma.activityLog.findMany({ where: { entityId: user.id }, orderBy: { createdAt: 'asc' }, select: { action: true, userId: true } })).toEqual([
      { action: 'USER_LOCKED', userId: ops.id },
      { action: 'USER_UNLOCKED', userId: ops.id },
    ])
  })

  it('never locks an operator, nor oneself', async () => {
    const ops = await operator()
    const other = await createUser('ops2@digistay.vn')
    await prisma.user.update({ where: { id: other.id }, data: { role: 'SUPER_ADMIN' } })
    signInAs(ops)
    expect((await lockRoute(req('/x', 'PATCH', { locked: true, note: 'Thử khoá' }), userParams(other.id))).status).toBe(403)
    expect((await lockRoute(req('/x', 'PATCH', { locked: true, note: 'Thử khoá' }), userParams(ops.id))).status).toBe(403)
    expect((await lockRoute(req('/x', 'PATCH', { locked: true, note: 'Thử khoá' }), userParams('nope'))).status).toBe(404)
  })

  it('turns two-factor off with how the person was verified, like the RUNBOOK script', async () => {
    const user = await createUser('mat2fa@example.com')
    await prisma.userTwoFactor.create({ data: { userId: user.id, secret: 'x', enabledAt: new Date() } })
    const ops = await operator()
    signInAs(ops)
    const reset = (body: unknown) => twoFactorRoute(req('/x', 'DELETE', body), userParams(user.id))

    expect((await reset({ verifiedVia: 'email', note: 'Gọi điện xác minh' })).status).toBe(400)
    expect((await reset({ verifiedVia: 'phone', note: 'Gọi 0901234567 (số đã lưu), khớp tên và workspace' })).status).toBe(200)
    expect(await prisma.userTwoFactor.findUnique({ where: { userId: user.id } })).toBeNull()
    expect(await prisma.activityLog.findFirst({ where: { action: 'TWO_FACTOR_RESET_BY_OPERATOR' } })).toMatchObject({
      userId: ops.id,
      entityType: 'USER',
      entityId: user.id,
      metadata: { by: 'ops@digistay.vn', verifiedVia: 'phone', email: 'mat2fa@example.com' },
    })
    expect((await reset({ verifiedVia: 'phone', note: 'Lần nữa' })).status).toBe(409)
  })
})
