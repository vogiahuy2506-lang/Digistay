/**
 * Plans against real Postgres and the real PayOS SDK talking to the fake
 * PayOS (src/test/integration/fake-payos.ts): the plan page's data, buying
 * a plan with a QR, the money arriving by webhook, by the page asking and by
 * reconcile, the limits, and the reminders.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
      get: async (k: string) => data.get(k) ?? null,
      set: async (k: string, v: string) => (data.set(k, v), 'OK'),
      del: async (k: string) => (data.delete(k) ? 1 : 0),
      incr: async (k: string) => {
        const n = Number(data.get(k) ?? 0) + 1
        data.set(k, String(n))
        return n
      },
      expire: async () => 1,
      ttl: async () => 600,
    },
  }
})
vi.mock('@/lib/db/redis', () => ({ redis: store.redis }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
// No request scope here: emails stay queued in the outbox.
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: () => {} }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { FakePayos, type FakeAccount } from '@/test/integration/fake-payos'
import { GET as getSubscription } from '@/app/api/workspaces/[id]/subscription/route'
import { POST as checkoutRoute } from '@/app/api/workspaces/[id]/subscription/checkout/route'
import { GET as paymentRoute } from '@/app/api/workspaces/[id]/subscription/payments/[paymentId]/route'
import { POST as platformWebhook } from '@/app/api/webhooks/payos/digistay/route'
import { POST as reconcileRoute } from '@/app/api/internal/payos-reconcile/route'
import { POST as createProperty } from '@/app/api/properties/route'
import { POST as invite } from '@/app/api/workspaces/[id]/invitations/route'
import { runSubscriptionReminders } from './jobs'
import { reconcileSubscriptionPayments } from './checkout'

const fake = new FakePayos()
const DIGISTAY: FakeAccount = { clientId: 'digistay-client', apiKey: 'digistay-api', checksumKey: 'digistay-checksum' }
const OTHER: FakeAccount = { clientId: 'other-client', apiKey: 'other-api', checksumKey: 'other-checksum' }
const saved = { ...process.env }
const DAY = 86_400_000

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) })

async function buy(workspaceId: string, plan: string, billing: string) {
  const res = await checkoutRoute(
    new NextRequest(`http://digistay.test/api/workspaces/${workspaceId}/subscription/checkout`, { method: 'POST', body: JSON.stringify({ plan, billing }) }),
    params({ id: workspaceId }),
  )
  return { res, body: await res.json() }
}

const deliver = async (body: object) =>
  platformWebhook(new NextRequest('http://digistay.test/api/webhooks/payos/digistay', { method: 'POST', body: JSON.stringify(body), headers: { 'x-real-ip': '203.0.113.20' } }))

const subOf = (workspaceId: string) => prisma.subscription.findUniqueOrThrow({ where: { workspaceId } })

beforeAll(async () => {
  await fake.start()
  fake.addAccount(DIGISTAY)
  fake.addAccount(OTHER)
  process.env.PAYOS_BASE_URL = fake.url
  process.env.NEXTAUTH_URL = 'http://digistay.test'
  process.env.CRON_SECRET = 'c'.repeat(40)
})
beforeEach(async () => {
  await resetDatabase()
  store.data.clear()
  fake.links.clear()
  process.env.DIGISTAY_PAYOS_CLIENT_ID = DIGISTAY.clientId
  process.env.DIGISTAY_PAYOS_API_KEY = DIGISTAY.apiKey
  process.env.DIGISTAY_PAYOS_CHECKSUM_KEY = DIGISTAY.checksumKey
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  await fake.stop()
  for (const k of ['PAYOS_BASE_URL', 'NEXTAUTH_URL', 'CRON_SECRET', 'DIGISTAY_PAYOS_CLIENT_ID', 'DIGISTAY_PAYOS_API_KEY', 'DIGISTAY_PAYOS_CHECKSUM_KEY']) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  await prisma.$disconnect()
})

describe('the plan page', () => {
  it('starts a workspace without a plan on the 14-day Growth trial, with its usage', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const res = await getSubscription(new NextRequest('http://digistay.test/x'), params({ id: t.workspace.id }))
    const { data } = await res.json()
    expect(data.subscription).toMatchObject({ plan: 'growth', trial: true, state: 'trial', daysLeft: 14, billing: null })
    expect(data.limits).toEqual({ properties: 3, rooms: 60, staff: 10, invoices: 100 })
    expect(data.usage).toMatchObject({ properties: 1, staff: 0, invoices: 0 })
    expect(data.checkoutReady).toBe(true)
  })

  it('is for owners and admins only', async () => {
    const t = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(t.member!)
    const res = await getSubscription(new NextRequest('http://digistay.test/x'), params({ id: t.workspace.id }))
    expect(res.status).toBe(403)
  })
})

describe('buying a plan', () => {
  it('makes a PayOS link on Digistay’s account and a QR, cancelling the code still waiting', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const first = await buy(t.workspace.id, 'growth', 'MONTH')
    expect(first.res.status).toBe(200)
    const second = await buy(t.workspace.id, 'starter', 'YEAR')
    expect(second.body.data).toMatchObject({ plan: 'starter', billing: 'YEAR', amount: 20_000, status: 'PENDING', description: 'DIGISTAY STARTER NAM' })
    expect(second.body.data.qrImage).toMatch(/^data:image\/png;base64,/)
    const link = fake.links.get(Number(second.body.data.orderCode))!
    expect(link).toMatchObject({ amount: 20_000, description: 'DIGISTAY STARTER NAM' })
    expect(link.account.clientId).toBe(DIGISTAY.clientId)
    const old = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: first.body.data.id } })
    expect(old.status).toBe('CANCELLED')
    // At PayOS too: the old QR can no longer be paid.
    expect(fake.links.get(Number(first.body.data.orderCode))!.status).toBe('CANCELLED')
  })

  it('says so when Digistay has no PayOS account set up', async () => {
    delete process.env.DIGISTAY_PAYOS_CHECKSUM_KEY
    const t = await createTenant()
    signInAs(t.owner)
    const { res, body } = await buy(t.workspace.id, 'growth', 'MONTH')
    expect(res.status).toBe(503)
    expect(body.error).toMatch(/chưa kết nối PayOS/)
  })

  it('applies the webhook once: new period from today, the receipt queued', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const { body } = await buy(t.workspace.id, 'business', 'MONTH')
    const paid = await fake.pay(Number(body.data.orderCode))
    const before = Date.now()
    expect((await deliver(paid)).status).toBe(200)
    expect((await deliver(paid)).status).toBe(200)

    const sub = await subOf(t.workspace.id)
    expect(sub).toMatchObject({ plan: 'business', billing: 'MONTH', trial: false })
    expect(sub.periodStart.getTime()).toBeGreaterThanOrEqual(before - 1000)
    const days = (sub.periodEnd.getTime() - sub.periodStart.getTime()) / DAY
    expect(days).toBeGreaterThanOrEqual(28)
    expect(days).toBeLessThanOrEqual(31)
    const mails = await prisma.emailOutbox.findMany({ where: { kind: 'subscription_paid' } })
    expect(mails.map((m) => m.toEmail)).toEqual([t.owner.email])
    // Logged once, not flagged.
    const logs = await prisma.activityLog.findMany({ where: { action: 'PLAN_PAID' } })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ workspaceId: t.workspace.id, userId: null, entityType: 'SUBSCRIPTION_PAYMENT', entityId: body.data.id })
    expect(logs[0].metadata).toEqual({ orderCode: body.data.orderCode, amount: body.data.amount, plan: 'business', billing: 'MONTH', source: 'webhook' })
    expect((await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: body.data.id } })).paidAfter).toBeNull()
  })

  it('refuses a webhook signed with another account and one with the wrong amount', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const { body } = await buy(t.workspace.id, 'growth', 'MONTH')
    const forged = await fake.webhookBody({ orderCode: Number(body.data.orderCode), amount: 5_000, description: 'x' }, OTHER.checksumKey)
    expect((await deliver(forged)).status).toBe(400)
    const short = await fake.pay(Number(body.data.orderCode), 4_000)
    expect((await deliver(short)).status).toBe(200)
    expect((await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: body.data.id } })).status).toBe('PENDING')
    // Still on the trial: no paid plan was written.
    expect((await prisma.subscription.findUnique({ where: { workspaceId: t.workspace.id } }))?.trial ?? true).toBe(true)

    // Logged for the ops alert, once although PayOS resends and reconcile asks again.
    expect((await deliver(short)).status).toBe(200)
    await reconcileSubscriptionPayments()
    const logs = await prisma.activityLog.findMany({ where: { action: 'PLAN_AMOUNT_MISMATCH' } })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ workspaceId: t.workspace.id, entityType: 'SUBSCRIPTION_PAYMENT', entityId: body.data.id })
    expect(logs[0].metadata).toEqual({ orderCode: body.data.orderCode, expected: 5_000, received: 4_000, source: 'webhook' })
    expect(await prisma.activityLog.count({ where: { action: 'PLAN_PAID' } })).toBe(0)
  })

  it('applies money the page asks PayOS about (?sync=1) when the webhook never comes', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const { body } = await buy(t.workspace.id, 'growth', 'YEAR')
    await fake.pay(Number(body.data.orderCode))
    const res = await paymentRoute(new NextRequest(`http://digistay.test/x?sync=1`), params({ id: t.workspace.id, paymentId: body.data.id }))
    expect((await res.json()).data.status).toBe('PAID')
    expect(await subOf(t.workspace.id)).toMatchObject({ plan: 'growth', billing: 'YEAR', trial: false })
  })

  it('applies it from the reconcile job too', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const { body } = await buy(t.workspace.id, 'starter', 'MONTH')
    await fake.pay(Number(body.data.orderCode))
    const res = await reconcileRoute(new NextRequest('http://digistay.test/api/internal/payos-reconcile', { method: 'POST', headers: { 'x-cron-secret': 'c'.repeat(40) } }))
    expect((await res.json()).data.plans).toMatchObject({ checked: 1, paid: 1 })
    expect((await subOf(t.workspace.id)).plan).toBe('starter')
  })

  it('does not show another workspace’s payment', async () => {
    const a = await createTenant()
    const b = await createTenant()
    signInAs(a.owner)
    const { body } = await buy(a.workspace.id, 'growth', 'MONTH')
    signInAs(b.owner)
    const res = await paymentRoute(new NextRequest('http://digistay.test/x'), params({ id: b.workspace.id, paymentId: body.data.id }))
    expect(res.status).toBe(404)
  })
})

describe('money for a code no longer open', () => {
  const paymentOf = (id: string) => prisma.subscriptionPayment.findUniqueOrThrow({ where: { id } })
  const paidLogs = () => prisma.activityLog.findMany({ where: { action: 'PLAN_PAID' }, orderBy: { createdAt: 'asc' } })

  it('is applied, flagged with the status the code had, and logged with it', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const first = await buy(t.workspace.id, 'growth', 'MONTH')
    const second = await buy(t.workspace.id, 'business', 'MONTH')
    // The customer pays the old QR anyway (PayOS took it before the cancel).
    expect((await deliver(await fake.pay(Number(first.body.data.orderCode)))).status).toBe(200)
    expect(await paymentOf(first.body.data.id)).toMatchObject({ status: 'PAID', paidAfter: 'CANCELLED', reviewedAt: null })
    expect((await subOf(t.workspace.id)).plan).toBe('growth')
    // Then the new one: applied as usual, not flagged.
    await deliver(await fake.pay(Number(second.body.data.orderCode)))
    expect(await paymentOf(second.body.data.id)).toMatchObject({ status: 'PAID', paidAfter: null })

    const logs = await paidLogs()
    expect(logs.map((l) => [l.entityId, (l.metadata as { paidAfter?: string }).paidAfter ?? null])).toEqual([
      [first.body.data.id, 'CANCELLED'],
      [second.body.data.id, null],
    ])
    expect(logs[0].metadata).toMatchObject({ orderCode: first.body.data.orderCode, source: 'webhook', plan: 'growth', billing: 'MONTH' })
  })

  it('the webhook and reconcile reporting it at once apply it and log it once', async () => {
    for (let round = 0; round < 3; round++) {
      await resetDatabase()
      const t = await createTenant()
      signInAs(t.owner)
      const { body } = await buy(t.workspace.id, 'growth', 'MONTH')
      await prisma.subscriptionPayment.update({ where: { id: body.data.id }, data: { status: 'CANCELLED' } })
      const paid = await fake.pay(Number(body.data.orderCode))
      await Promise.all([deliver(paid), deliver(paid), reconcileSubscriptionPayments()])
      expect(await paymentOf(body.data.id)).toMatchObject({ status: 'PAID', paidAfter: 'CANCELLED' })
      expect(await prisma.activityLog.count({ where: { action: 'PLAN_PAID' } })).toBe(1)
      expect(await prisma.emailOutbox.count({ where: { kind: 'subscription_paid' } })).toBe(1)
    }
  })

  it('an expired code paid late keeps EXPIRED', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const { body } = await buy(t.workspace.id, 'starter', 'MONTH')
    await prisma.subscriptionPayment.update({ where: { id: body.data.id }, data: { status: 'EXPIRED' } })
    await deliver(await fake.pay(Number(body.data.orderCode)))
    expect(await paymentOf(body.data.id)).toMatchObject({ status: 'PAID', paidAfter: 'EXPIRED' })
    expect((await paidLogs())[0].metadata).toMatchObject({ paidAfter: 'EXPIRED' })
  })

  it('a new checkout still works when PayOS refuses to cancel the old code; reconcile finds the old one paid', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const first = await buy(t.workspace.id, 'growth', 'MONTH')
    // PayOS answers the cancel with an error (here: the link is not PENDING there).
    const oldLink = fake.links.get(Number(first.body.data.orderCode))!
    oldLink.status = 'EXPIRED'
    const second = await buy(t.workspace.id, 'starter', 'YEAR')
    expect(second.res.status).toBe(200)
    expect(second.body.data.status).toBe('PENDING')
    expect((await paymentOf(first.body.data.id)).status).toBe('CANCELLED')
    expect(oldLink.status).toBe('EXPIRED')

    // The old code is paid and its webhook never comes: the job asks PayOS about it.
    await fake.pay(oldLink.orderCode)
    expect(await reconcileSubscriptionPayments()).toEqual({ checked: 2, paid: 1, failed: 0 })
    expect(await paymentOf(first.body.data.id)).toMatchObject({ status: 'PAID', paidAfter: 'CANCELLED' })
    expect((await paidLogs())[0].metadata).toMatchObject({ source: 'reconcile', paidAfter: 'CANCELLED' })
  })

  it('reconcile asks about cancelled codes for a day only, and only those that had a link', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const { body } = await buy(t.workspace.id, 'growth', 'MONTH')
    await prisma.subscriptionPayment.update({ where: { id: body.data.id }, data: { status: 'CANCELLED' } })
    await prisma.subscriptionPayment.create({
      data: { workspaceId: t.workspace.id, plan: 'growth', billing: 'MONTH', amount: 5_000, orderCode: '990000001', status: 'CANCELLED' },
    })
    expect((await reconcileSubscriptionPayments()).checked).toBe(1)
    await prisma.$executeRaw`UPDATE subscription_payments SET "updatedAt" = now() - interval '25 hours' WHERE id = ${body.data.id}`
    expect((await reconcileSubscriptionPayments()).checked).toBe(0)
  })
})

describe('limits and the lock', () => {
  async function onStarter(t: { workspace: { id: string } }) {
    const now = new Date()
    await prisma.subscription.upsert({
      where: { workspaceId: t.workspace.id },
      create: { workspaceId: t.workspace.id, plan: 'starter', billing: 'MONTH', trial: false, periodStart: now, periodEnd: new Date(now.getTime() + 30 * DAY) },
      update: { plan: 'starter', billing: 'MONTH', trial: false, periodStart: now, periodEnd: new Date(now.getTime() + 30 * DAY) },
    })
  }
  const newProperty = (workspaceId: string) =>
    createProperty(
      new NextRequest('http://digistay.test/api/properties', {
        method: 'POST',
        body: JSON.stringify({ workspaceId, name: `Second ${Date.now()}`, type: 'HOTEL', address: '2 Test Street', city: 'Hue', subdomain: `second-${Date.now()}` }),
      }),
    )

  it('refuses a second property on Starter (1 property) with the plan’s message', async () => {
    const t = await createTenant()
    await onStarter(t)
    signInAs(t.owner)
    const res = await newProperty(t.workspace.id)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/tối đa 1 cơ sở/)
  })

  it('counts open invitations as staff seats', async () => {
    const t = await createTenant()
    await onStarter(t)
    signInAs(t.owner)
    const send = (email: string) =>
      invite(new NextRequest(`http://digistay.test/x`, { method: 'POST', body: JSON.stringify({ email, role: 'RECEPTIONIST' }) }), params({ id: t.workspace.id }))
    for (let i = 0; i < 3; i++) expect((await send(`staff${i}@example.com`)).status).toBeLessThan(300)
    const fourth = await send('staff3@example.com')
    expect(fourth.status).toBe(403)
    expect((await fourth.json()).error).toMatch(/tối đa 3 tài khoản nhân viên/)
  })

  it('locks the workspace 7 days after the end, and paying unlocks it', async () => {
    const t = await createTenant()
    const ended = new Date(Date.now() - 8 * DAY)
    await prisma.subscription.create({ data: { workspaceId: t.workspace.id, plan: 'growth', trial: true, periodStart: new Date(ended.getTime() - 14 * DAY), periodEnd: ended } })
    signInAs(t.owner)
    const locked = await newProperty(t.workspace.id)
    expect(locked.status).toBe(402)

    // Paying is allowed while locked, and lifts the lock.
    const { res, body } = await buy(t.workspace.id, 'growth', 'MONTH')
    expect(res.status).toBe(200)
    await deliver(await fake.pay(Number(body.data.orderCode)))
    expect((await newProperty(t.workspace.id)).status).toBe(200)
  })
})

describe('reminders', () => {
  it('sends the 7-day reminder once, then the 1-day one', async () => {
    const owner = await createUser()
    const workspace = await prisma.workspace.create({ data: { name: 'Mây Biển', slug: `ws-${Date.now()}`, ownerId: owner.id } })
    const end = new Date(Date.now() + 6 * DAY)
    await prisma.subscription.create({ data: { workspaceId: workspace.id, plan: 'growth', billing: 'MONTH', trial: false, periodStart: new Date(end.getTime() - 30 * DAY), periodEnd: end } })

    expect(await runSubscriptionReminders()).toMatchObject({ sent: 1 })
    expect(await runSubscriptionReminders()).toMatchObject({ sent: 0 })
    expect(await runSubscriptionReminders(new Date(end.getTime() - 0.5 * DAY))).toMatchObject({ sent: 1 })
    const mails = await prisma.emailOutbox.findMany({ where: { kind: 'subscription_reminder' }, orderBy: { createdAt: 'asc' } })
    expect(mails).toHaveLength(2)
    expect(mails.every((m) => m.toEmail === owner.email)).toBe(true)
  })
})
