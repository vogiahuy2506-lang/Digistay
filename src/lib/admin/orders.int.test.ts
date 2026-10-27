/**
 * The operators' plan orders (/admin/orders, src/lib/admin/orders.ts) against
 * real Postgres and the real PayOS SDK on the fake PayOS: only a SUPER_ADMIN
 * gets in; the list and its filters (deleted workspaces included); the
 * figures; cancelling a code still waiting (here and at PayOS); asking PayOS
 * again; marking an order paid after its code was closed as looked at.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
// No request scope here: what runs after the response is left to the jobs.
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: () => {} }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { FakePayos, type FakeAccount } from '@/test/integration/fake-payos'
import { createCheckout } from '@/lib/billing/checkout'
import { ordersSummary } from './orders'
import { GET as listRoute } from '@/app/api/admin/orders/route'
import { POST as orderRoute } from '@/app/api/admin/orders/[id]/route'

const DAY = 86_400_000
const fake = new FakePayos()
const DIGISTAY: FakeAccount = { clientId: 'digistay-client', apiKey: 'digistay-api', checksumKey: 'digistay-checksum' }
const KEYS = ['PAYOS_BASE_URL', 'DIGISTAY_PAYOS_CLIENT_ID', 'DIGISTAY_PAYOS_API_KEY', 'DIGISTAY_PAYOS_CHECKSUM_KEY'] as const
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))

const signInAs = (user: { id: string; email: string } | null) =>
  vi.mocked(auth).mockResolvedValue((user ? { user: { id: user.id, email: user.email } } : null) as never)
const list = async (query = '') => {
  const res = await listRoute(new NextRequest(`http://digistay.test/api/admin/orders${query}`))
  return { status: res.status, body: await res.json() }
}
const act = async (id: string, body: unknown) => {
  const res = await orderRoute(
    new NextRequest(`http://digistay.test/api/admin/orders/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) }
  )
  return { status: res.status, body: await res.json() }
}
const codes = (body: { data: { rows: { orderCode: string }[] } }) => body.data.rows.map((r) => r.orderCode)

let seq = 0
/** A plan order written directly (no PayOS link unless made with createCheckout). */
function order(workspaceId: string, data: Partial<Prisma.SubscriptionPaymentUncheckedCreateInput> = {}) {
  seq += 1
  return prisma.subscriptionPayment.create({
    data: { workspaceId, plan: 'growth', billing: 'MONTH', amount: 5_000, orderCode: String(500_000 + seq), ...data },
  })
}

async function operator() {
  const user = await createUser(`ops-${Date.now()}@digistay.vn`)
  return prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } })
}

beforeAll(async () => {
  await fake.start()
  fake.addAccount(DIGISTAY)
  process.env.PAYOS_BASE_URL = fake.url
})
beforeEach(async () => {
  await resetDatabase()
  fake.links.clear()
  process.env.DIGISTAY_PAYOS_CLIENT_ID = DIGISTAY.clientId
  process.env.DIGISTAY_PAYOS_API_KEY = DIGISTAY.apiKey
  process.env.DIGISTAY_PAYOS_CHECKSUM_KEY = DIGISTAY.checksumKey
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(async () => {
  await fake.stop()
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  await prisma.$disconnect()
})

describe('who gets in', () => {
  it('401 signed out, 404 for anyone but a SUPER_ADMIN, the list and the actions alike', async () => {
    const t = await createTenant()
    const o = await order(t.workspace.id)
    signInAs(null)
    expect((await list()).status).toBe(401)
    expect((await act(o.id, { action: 'cancel' })).status).toBe(401)
    signInAs(t.owner)
    expect((await list()).status).toBe(404)
    expect((await act(o.id, { action: 'cancel' })).status).toBe(404)
    expect((await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('PENDING')
    signInAs(await operator())
    expect((await list()).status).toBe(200)
  })
})

describe('the list', () => {
  it('filters by text, status, flag and workspace, newest first, deleted workspaces included', async () => {
    const admin = await operator()
    const a = await createTenant()
    const b = await createTenant()
    await prisma.workspace.update({ where: { id: b.workspace.id }, data: { name: 'Khách sạn Mây Biển' } })
    const now = Date.now()
    const a1 = await order(a.workspace.id, { orderCode: '810001', createdAt: new Date(now - 3 * DAY), createdById: a.owner.id })
    await order(a.workspace.id, { orderCode: '810002', createdAt: new Date(now - 2 * DAY), status: 'PAID', paidAt: new Date(now - 2 * DAY) })
    const b1 = await order(b.workspace.id, {
      orderCode: '920001',
      createdAt: new Date(now - DAY),
      status: 'PAID',
      paidAt: new Date(now - DAY),
      paidAfter: 'EXPIRED',
      reviewedAt: new Date(now),
      reviewedById: admin.id,
      reviewNote: 'Đã hoàn tiền',
    })
    const b2 = await order(b.workspace.id, { orderCode: '920002', createdAt: new Date(now), status: 'PAID', paidAt: new Date(now), paidAfter: 'CANCELLED' })
    signInAs(admin)

    const all = await list()
    expect(all.body.data).toMatchObject({ total: 4, page: 1, size: 25 })
    expect(codes(all.body)).toEqual(['920002', '920001', '810002', '810001'])
    const row = all.body.data.rows.find((r: { id: string }) => r.id === a1.id)
    expect(row).toMatchObject({
      workspace: { id: a.workspace.id, name: a.workspace.name, slug: a.workspace.slug, deleted: false },
      buyer: { email: a.owner.email },
      plan: 'growth',
      billing: 'MONTH',
      amount: 5_000,
      status: 'PENDING',
      paidAfter: null,
      invoice: null,
    })
    expect(all.body.data.rows.find((r: { id: string }) => r.id === b1.id)).toMatchObject({ reviewer: admin.email, reviewNote: 'Đã hoàn tiền', buyer: null })

    expect(codes((await list('?q=8100')).body)).toEqual(['810002', '810001'])
    expect(codes((await list('?q=810001')).body)).toEqual(['810001'])
    expect(codes((await list('?q=mây biển')).body)).toEqual(['920002', '920001'])
    expect(codes((await list(`?q=${b.workspace.slug}`)).body)).toEqual(['920002', '920001'])
    expect(codes((await list(`?q=${a.owner.email.toUpperCase()}`)).body)).toEqual(['810002', '810001'])
    expect(codes((await list('?status=PENDING')).body)).toEqual(['810001'])
    expect(codes((await list('?flag=late')).body)).toEqual(['920002', '920001'])
    expect(codes((await list('?flag=unreviewed')).body)).toEqual(['920002'])
    expect(codes((await list(`?workspace=${a.workspace.id}&status=PAID`)).body)).toEqual(['810002'])
    // Empty parameters are no filter; a bad one is refused.
    expect((await list('?q=&status=&flag=')).body.data.total).toBe(4)
    expect((await list('?status=REFUNDED')).status).toBe(400)

    // A deleted workspace's orders stay listed, and searchable by its name.
    await prisma.workspace.update({ where: { id: b.workspace.id }, data: { deletedAt: new Date() } })
    const deleted = await list('?q=mây biển')
    expect(codes(deleted.body)).toEqual(['920002', '920001'])
    expect(deleted.body.data.rows[0]).toMatchObject({ id: b2.id, workspace: { deleted: true } })

    // Paging.
    await Promise.all(Array.from({ length: 25 }, () => order(a.workspace.id, { createdAt: new Date(now - 10 * DAY) })))
    const second = await list('?page=2')
    expect(second.body.data).toMatchObject({ total: 29, page: 2 })
    expect(second.body.data.rows).toHaveLength(4)
  })

  it('sums the money by when it came: this month (Vietnam time), the last 30 days; counts what waits and what is flagged', async () => {
    const t = await createTenant()
    // 15/10/2026 12:00 in Vietnam.
    const now = new Date('2026-10-15T05:00:00Z')
    const at = (iso: string) => new Date(iso)
    await order(t.workspace.id, { status: 'PAID', amount: 10_000, paidAt: at('2026-10-14T03:00:00Z') })
    // 1/10 06:30 in Vietnam: this month, though still 30/9 in UTC.
    await order(t.workspace.id, { status: 'PAID', amount: 5_000, paidAt: at('2026-09-30T23:30:00Z') })
    // 30/9 in Vietnam: last month, but within 30 days.
    await order(t.workspace.id, { status: 'PAID', amount: 2_000, paidAt: at('2026-09-30T10:00:00Z'), paidAfter: 'CANCELLED' })
    // More than 30 days ago.
    await order(t.workspace.id, { status: 'PAID', amount: 20_000, paidAt: at('2026-09-01T10:00:00Z'), paidAfter: 'EXPIRED', reviewedAt: at('2026-09-02T00:00:00Z') })
    await order(t.workspace.id, { status: 'PENDING', expiresAt: at('2026-10-15T05:20:00Z') })
    await order(t.workspace.id, { status: 'PENDING', expiresAt: at('2026-10-15T04:00:00Z') })
    await order(t.workspace.id, { status: 'CANCELLED' })

    expect(await ordersSummary(now)).toEqual({ revenueMonth: 15_000, paidMonth: 2, revenue30d: 17_000, pending: 1, flagged: 1 })

    signInAs(await operator())
    const { body } = await list()
    expect(Object.keys(body.data.summary).sort()).toEqual(['flagged', 'paidMonth', 'pending', 'revenue30d', 'revenueMonth'])
    expect(body.data.summary.flagged).toBe(1)
  })
})

describe('what an operator can do', () => {
  it('cancels a code still waiting, at PayOS too, and logs it; nothing else can be cancelled', async () => {
    const admin = await operator()
    const t = await createTenant()
    const waiting = await createCheckout({ workspaceId: t.workspace.id, plan: 'growth', billing: 'MONTH', userId: t.owner.id, returnUrl: 'http://digistay.test/x' })
    signInAs(admin)

    const res = await act(waiting.id, { action: 'cancel', note: 'Khách nhờ huỷ' })
    expect(res).toMatchObject({ status: 200, body: { success: true, data: { status: 'CANCELLED', payos: true } } })
    expect((await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: waiting.id } })).status).toBe('CANCELLED')
    expect(fake.links.get(Number(waiting.orderCode))!.status).toBe('CANCELLED')
    const log = await prisma.activityLog.findFirstOrThrow({ where: { action: 'PLAN_ORDER_CANCELLED' } })
    expect(log).toMatchObject({ userId: admin.id, workspaceId: t.workspace.id, entityType: 'SUBSCRIPTION_PAYMENT', entityId: waiting.id })
    expect(log.metadata).toEqual({ by: admin.email, orderCode: waiting.orderCode, note: 'Khách nhờ huỷ' })

    expect(await act(waiting.id, { action: 'cancel' })).toMatchObject({ status: 409, body: { error: 'Chỉ huỷ được đơn đang chờ thanh toán' } })
    const paid = await order(t.workspace.id, { status: 'PAID', paidAt: new Date() })
    expect((await act(paid.id, { action: 'cancel' })).status).toBe(409)
    expect(await prisma.activityLog.count({ where: { action: 'PLAN_ORDER_CANCELLED' } })).toBe(1)

    // PayOS failing to cancel does not stop it here; the page is told.
    const noLink = await order(t.workspace.id)
    expect((await act(noLink.id, { action: 'cancel' })).body.data).toEqual({ status: 'CANCELLED', payos: false })
    expect((await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: noLink.id } })).status).toBe('CANCELLED')
  })

  it('asks PayOS again: applies a payment it reports, refuses a paid order, says when PayOS fails', async () => {
    const t = await createTenant()
    const waiting = await createCheckout({ workspaceId: t.workspace.id, plan: 'starter', billing: 'MONTH', userId: t.owner.id, returnUrl: 'http://digistay.test/x' })
    signInAs(await operator())
    expect(await act(waiting.id, { action: 'sync' })).toMatchObject({ status: 200, body: { data: { status: 'PENDING' } } })
    await fake.pay(Number(waiting.orderCode))
    expect(await act(waiting.id, { action: 'sync' })).toMatchObject({ status: 200, body: { data: { status: 'PAID' } } })
    expect((await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: t.workspace.id } })).plan).toBe('starter')
    expect(await act(waiting.id, { action: 'sync' })).toMatchObject({ status: 409, body: { error: 'Đơn đã thanh toán, không cần hỏi lại PayOS' } })

    const unknown = await order(t.workspace.id, { status: 'FAILED' })
    const failed = await act(unknown.id, { action: 'sync' })
    expect(failed.status).toBe(502)
    expect(failed.body.error).toMatch(/^Không hỏi được PayOS: /)

    delete process.env.DIGISTAY_PAYOS_CHECKSUM_KEY
    expect((await act(unknown.id, { action: 'sync' })).status).toBe(503)
  })

  it('marks an order paid after its code was closed as looked at, with a note, once', async () => {
    const admin = await operator()
    const t = await createTenant()
    const flagged = await order(t.workspace.id, { status: 'PAID', paidAt: new Date(), paidAfter: 'CANCELLED' })
    const normal = await order(t.workspace.id, { status: 'PAID', paidAt: new Date() })
    signInAs(admin)

    expect(await act(normal.id, { action: 'review', note: 'Không sao' })).toMatchObject({ status: 409 })
    expect(await act(flagged.id, { action: 'review' })).toMatchObject({ status: 400, body: { error: 'Ghi chú cần ít nhất 3 ký tự' } })
    expect((await act(flagged.id, { action: 'review', note: ' ok ' })).status).toBe(400)
    expect((await list()).body.data.summary.flagged).toBe(1)

    expect(await act(flagged.id, { action: 'review', note: 'Khách trả trùng, đã hoàn' })).toMatchObject({ status: 200, body: { success: true } })
    const after = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: flagged.id } })
    expect(after).toMatchObject({ reviewedById: admin.id, reviewNote: 'Khách trả trùng, đã hoàn' })
    expect(after.reviewedAt).not.toBeNull()
    const log = await prisma.activityLog.findFirstOrThrow({ where: { action: 'PLAN_ORDER_REVIEWED' } })
    expect(log).toMatchObject({ userId: admin.id, workspaceId: t.workspace.id, entityId: flagged.id })
    expect(log.metadata).toEqual({ by: admin.email, orderCode: flagged.orderCode, note: 'Khách trả trùng, đã hoàn' })
    expect((await list()).body.data.summary.flagged).toBe(0)

    expect(await act(flagged.id, { action: 'review', note: 'Lần nữa' })).toMatchObject({ status: 409, body: { error: 'Đơn này đã được đánh dấu đã xem' } })
  })

  it('refuses an unknown action and an unknown order', async () => {
    const t = await createTenant()
    const o = await order(t.workspace.id)
    signInAs(await operator())
    expect((await act(o.id, { action: 'refund' })).status).toBe(400)
    expect((await act('nope', { action: 'cancel' })).status).toBe(404)
  })
})
