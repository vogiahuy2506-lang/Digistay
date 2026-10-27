/**
 * The platform's activity log (GET /api/admin/activity, src/lib/admin/activity.ts)
 * against real Postgres: operators only, every filter, cursor paging, and
 * the names of deleted and purged workspaces.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), authOptions: {} }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GET } from './route'
import { createBooking, createPendingPayment, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'

interface Row {
  id: string
  createdAt: string
  action: string
  entityType: string
  entityId: string
  actor: { id: string; name: string | null; email: string | null } | null
  workspace: { id: string; name: string | null; slug: string | null; deleted: boolean } | null
  property: { id: string; name: string | null; deleted: boolean } | null
  metadata: unknown
}
interface Page {
  rows: Row[]
  nextCursor: string | null
  facets?: { actions: string[]; entityTypes: string[] }
  scope?: { workspace: { id: string; name: string } | null; user: { id: string; email: string } | null }
}

function signInAs(user: { id: string; email: string } | null) {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(user ? { user: { id: user.id, email: user.email } } : null)
}

async function get(query: Record<string, string> = {}) {
  const res = await GET(new NextRequest(`http://localhost/api/admin/activity?${new URLSearchParams(query)}`))
  return { status: res.status, body: (await res.json()) as { success: boolean; data: Page; error?: string } }
}

/** The page's rows, by what they were: "action entityType". */
async function seen(query: Record<string, string>) {
  const { status, body } = await get(query)
  expect(status).toBe(200)
  return body.data.rows.map((r) => `${r.action} ${r.entityType}`)
}

async function operator() {
  const user = await createUser()
  return prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } })
}

/**
 * Two hotels' logs and one operator's, oldest first:
 * A's owner creates and deletes a booking (rows with only a propertyId),
 * a payment of that booking is confirmed, B's owner edits B's hotel, PayOS
 * (no one) pays B, and the operator locks B's owner.
 */
async function seed() {
  const a = await createTenant()
  const b = await createTenant()
  const admin = await operator()
  const booking = await createBooking(a.property.id)
  const payment = await createPendingPayment(booking, 500_000)
  const at = (iso: string) => new Date(iso)
  await prisma.activityLog.createMany({
    data: [
      // 20/10 22:00 and 23:30 in Vietnam.
      { userId: a.owner.id, propertyId: a.property.id, action: 'CREATE', entityType: 'BOOKING', entityId: booking.id, createdAt: at('2026-10-20T15:00:00Z') },
      { userId: a.owner.id, propertyId: a.property.id, action: 'DELETE', entityType: 'BOOKING', entityId: booking.id, createdAt: at('2026-10-20T16:30:00Z') },
      // 21/10 00:30 and later in Vietnam.
      {
        userId: a.owner.id,
        workspaceId: a.workspace.id,
        propertyId: a.property.id,
        action: 'CONFIRM_PAYMENT',
        entityType: 'PAYMENT',
        entityId: payment.id,
        ipAddress: '203.0.113.7',
        userAgent: 'Test browser',
        createdAt: at('2026-10-20T17:30:00Z'),
      },
      { userId: b.owner.id, workspaceId: b.workspace.id, propertyId: b.property.id, action: 'UPDATE', entityType: 'PROPERTY', entityId: b.property.id, changes: { name: 'B' }, createdAt: at('2026-10-21T03:00:00Z') },
      { propertyId: b.property.id, action: 'PAYOS_PAID', entityType: 'PAYMENT', entityId: 'pay-b', createdAt: at('2026-10-22T03:00:00Z') },
      { userId: admin.id, action: 'USER_LOCKED', entityType: 'USER', entityId: b.owner.id, metadata: { by: admin.email, reason: 'test' }, createdAt: at('2026-10-23T03:00:00Z') },
    ],
  })
  return { a, b, admin, booking, payment }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('who may read the platform log', () => {
  it('401 signed out, 404 for anyone but an operator, 200 for an operator', async () => {
    const { a } = await seed()
    signInAs(null)
    expect((await get()).status).toBe(401)

    signInAs(a.owner)
    const owner = await get()
    expect(owner.status).toBe(404)
    expect(owner.body.data).toBeUndefined()

    const admin = await operator()
    signInAs(admin)
    const ok = await get()
    expect(ok.status).toBe(200)
    expect(ok.body.data.rows).toHaveLength(6)
  })

  it('a locked operator is turned away too', async () => {
    const admin = await operator()
    await prisma.user.update({ where: { id: admin.id }, data: { disabledAt: new Date() } })
    signInAs(admin)
    expect((await get()).status).toBe(404)
  })
})

describe('the platform log', () => {
  it('lists newest first, with who, where (a hotel-only row gets its workspace) and what', async () => {
    const { a, b, admin } = await seed()
    signInAs(admin)
    const { body } = await get()
    const { rows, nextCursor, facets } = body.data
    expect(rows.map((r) => r.action)).toEqual(['USER_LOCKED', 'PAYOS_PAID', 'UPDATE', 'CONFIRM_PAYMENT', 'DELETE', 'CREATE'])
    expect(nextCursor).toBeNull()

    const deleted = rows.find((r) => r.action === 'DELETE')!
    expect(deleted.actor).toEqual({ id: a.owner.id, name: 'Test User', email: a.owner.email })
    expect(deleted.workspace).toEqual({ id: a.workspace.id, name: a.workspace.name, slug: a.workspace.slug, deleted: false })
    expect(deleted.property).toEqual({ id: a.property.id, name: a.property.name, deleted: false })

    const payos = rows.find((r) => r.action === 'PAYOS_PAID')!
    expect(payos.actor).toBeNull()
    expect(payos.workspace?.id).toBe(b.workspace.id)

    const locked = rows.find((r) => r.action === 'USER_LOCKED')!
    expect(locked.workspace).toBeNull()
    expect(locked.metadata).toEqual({ by: admin.email, reason: 'test' })

    expect(facets).toEqual({
      actions: ['CONFIRM_PAYMENT', 'CREATE', 'DELETE', 'PAYOS_PAID', 'UPDATE', 'USER_LOCKED'],
      entityTypes: ['BOOKING', 'PAYMENT', 'PROPERTY', 'USER'],
    })
  })

  it('searches by email, workspace name, hotel name, booking code and id', async () => {
    const { a, b, admin, booking, payment } = await seed()
    signInAs(admin)
    // The actor's email (any case): what A's owner did.
    expect(await seen({ q: a.owner.email.toUpperCase() })).toEqual(['CONFIRM_PAYMENT PAYMENT', 'DELETE BOOKING', 'CREATE BOOKING'])
    // A workspace's name: its rows and its hotels' (PayOS wrote only B's propertyId).
    expect(await seen({ q: b.workspace.name })).toEqual(['PAYOS_PAID PAYMENT', 'UPDATE PROPERTY'])
    expect(await seen({ q: b.workspace.slug })).toEqual(['PAYOS_PAID PAYMENT', 'UPDATE PROPERTY'])
    expect(await seen({ q: a.property.name })).toEqual(['CONFIRM_PAYMENT PAYMENT', 'DELETE BOOKING', 'CREATE BOOKING'])
    // A booking code: the booking and its payments.
    expect(await seen({ q: booking.bookingCode.toLowerCase() })).toEqual(['CONFIRM_PAYMENT PAYMENT', 'DELETE BOOKING', 'CREATE BOOKING'])
    // Any id: the thing it is.
    expect(await seen({ q: payment.id })).toEqual(['CONFIRM_PAYMENT PAYMENT'])
    expect(await seen({ q: 'nothing-like-this' })).toEqual([])
  })

  it('filters by action, entity, workspace, user and days (Vietnam time)', async () => {
    const { a, b, admin } = await seed()
    signInAs(admin)
    expect(await seen({ action: 'DELETE' })).toEqual(['DELETE BOOKING'])
    expect(await seen({ entity: 'PAYMENT' })).toEqual(['PAYOS_PAID PAYMENT', 'CONFIRM_PAYMENT PAYMENT'])
    expect(await seen({ action: 'CONFIRM_PAYMENT', entity: 'BOOKING' })).toEqual([])
    // A workspace: its own rows and its hotel's, including those with only a propertyId.
    expect(await seen({ workspace: a.workspace.id })).toEqual(['CONFIRM_PAYMENT PAYMENT', 'DELETE BOOKING', 'CREATE BOOKING'])
    // A user: what they did, and what was done to their account.
    expect(await seen({ user: b.owner.id })).toEqual(['USER_LOCKED USER', 'UPDATE PROPERTY'])
    expect(await seen({ user: admin.id })).toEqual(['USER_LOCKED USER'])
    // 20/10 ends at 17:00 UTC; 21/10 is the rest.
    expect(await seen({ to: '2026-10-20' })).toEqual(['DELETE BOOKING', 'CREATE BOOKING'])
    expect(await seen({ from: '2026-10-21', to: '2026-10-21' })).toEqual(['UPDATE PROPERTY', 'CONFIRM_PAYMENT PAYMENT'])
    expect(await seen({ from: '2026-10-22' })).toEqual(['USER_LOCKED USER', 'PAYOS_PAID PAYMENT'])
    expect(await seen({ q: a.owner.email, from: '2026-10-21' })).toEqual(['CONFIRM_PAYMENT PAYMENT'])
  })

  it('names the workspace and user filtered on, on the first page only', async () => {
    const { a, b, admin } = await seed()
    signInAs(admin)
    const { body } = await get({ workspace: a.workspace.id, user: b.owner.id })
    expect(body.data.scope?.workspace).toMatchObject({ id: a.workspace.id, name: a.workspace.name, deleted: false })
    expect(body.data.scope?.user).toMatchObject({ id: b.owner.id, email: b.owner.email })
    expect(body.data.rows).toEqual([])
  })

  it('answers 400 to filters it cannot read', async () => {
    const admin = await operator()
    signInAs(admin)
    const bad = async (query: Record<string, string>) => {
      const res = await get(query)
      expect(res.status, JSON.stringify(query)).toBe(400)
      return res.body.error
    }
    expect(await bad({ action: 'DROP TABLE' })).toBe('Bộ lọc không hợp lệ')
    expect(await bad({ q: 'x'.repeat(201) })).toBe('Bộ lọc không hợp lệ')
    expect(await bad({ from: '2026-02-30' })).toBe('Khoảng ngày không hợp lệ')
    expect(await bad({ from: '21/10/2026' })).toBe('Khoảng ngày không hợp lệ')
    expect(await bad({ from: '2026-10-22', to: '2026-10-21' })).toBe('Khoảng ngày không hợp lệ')
    expect(await bad({ cursor: 'not-a-cursor' })).toBe('Trang nhật ký không hợp lệ')
    // Empty fields are no filter.
    expect((await get({ q: '', action: '', from: '' })).status).toBe(200)
  })
})

describe('paging', () => {
  it('walks the whole log 50 rows a page, rows of the same instant neither lost nor repeated', async () => {
    const admin = await operator()
    signInAs(admin)
    const same = new Date('2026-10-25T03:00:00Z')
    await prisma.activityLog.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        userId: admin.id,
        action: 'UPDATE',
        entityType: 'ROOM',
        entityId: `room-${i}`,
        // 80 rows written in the same millisecond, the rest a second apart.
        createdAt: i < 80 ? same : new Date(same.getTime() + (i - 79) * 1000),
      })),
    })

    const ids: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const { status, body }: Awaited<ReturnType<typeof get>> = await get(cursor ? { cursor } : {})
      expect(status).toBe(200)
      // The filters' choices come with the first page only.
      expect(body.data.facets === undefined).toBe(pages > 0)
      ids.push(...body.data.rows.map((r) => r.entityId))
      cursor = body.data.nextCursor
      pages += 1
    } while (cursor)

    expect(pages).toBe(3)
    expect(ids).toHaveLength(120)
    expect(new Set(ids).size).toBe(120)
    // Newest first: the 40 later rows, then the 80 of the same instant.
    expect(ids.slice(0, 3)).toEqual(['room-119', 'room-118', 'room-117'])
  })

  it('pages within a filter', async () => {
    const { a, admin } = await seed()
    signInAs(admin)
    await prisma.activityLog.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        userId: a.owner.id,
        propertyId: a.property.id,
        action: 'UPDATE',
        entityType: 'ROOM',
        entityId: `room-${i}`,
        createdAt: new Date(Date.UTC(2026, 9, 24, 3, 0, i)),
      })),
    })
    const first = await get({ workspace: a.workspace.id })
    expect(first.body.data.rows).toHaveLength(50)
    const second = await get({ workspace: a.workspace.id, cursor: first.body.data.nextCursor! })
    // 10 more rooms, then the booking's three rows.
    expect(second.body.data.rows).toHaveLength(13)
    expect(second.body.data.nextCursor).toBeNull()
  })
})

describe('deleted and purged workspaces', () => {
  it('still names a deleted workspace and hotel, and a purged one from its own row', async () => {
    const { a, admin } = await seed()
    signInAs(admin)
    const now = new Date()
    await prisma.workspace.update({ where: { id: a.workspace.id }, data: { deletedAt: now } })
    await prisma.property.update({ where: { id: a.property.id }, data: { deletedAt: now } })
    await prisma.activityLog.create({
      data: { action: 'PURGE', entityType: 'WORKSPACE', entityId: 'gone-workspace', metadata: { name: 'Khách sạn Cũ', slug: 'cu' } },
    })

    const { body } = await get()
    const purged = body.data.rows.find((r) => r.action === 'PURGE')!
    expect(purged.workspace).toEqual({ id: 'gone-workspace', name: 'Khách sạn Cũ', slug: null, deleted: true })

    const deleted = body.data.rows.find((r) => r.action === 'DELETE')!
    expect(deleted.workspace).toEqual({ id: a.workspace.id, name: a.workspace.name, slug: a.workspace.slug, deleted: true })
    expect(deleted.property).toEqual({ id: a.property.id, name: a.property.name, deleted: true })

    // Still found by its name, its hotel's rows included, and by its id; the purged one by its id.
    expect(await seen({ q: a.workspace.name })).toEqual(['CONFIRM_PAYMENT PAYMENT', 'DELETE BOOKING', 'CREATE BOOKING'])
    expect(await seen({ workspace: a.workspace.id })).toHaveLength(3)
    expect(await seen({ workspace: 'gone-workspace' })).toEqual(['PURGE WORKSPACE'])
    const scoped = await get({ workspace: a.workspace.id })
    expect(scoped.body.data.scope?.workspace).toMatchObject({ name: a.workspace.name, deleted: true })
  })
})
