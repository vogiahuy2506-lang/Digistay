/**
 * A workspace over its plan (src/lib/billing/overage.ts) against real
 * Postgres: the 7-day grace and its one email, locking the excess newest
 * first, the usage fitting afterwards, unlocking on a bigger plan, and what
 * a lock means for routes: a locked property is read-only, a locked room
 * type takes no new bookings (guests or staff) while its existing ones go
 * on, a locked member has no access.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session.current), authOptions: {} }))
const redis = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
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
  }
})
vi.mock('@/lib/db/redis', () => ({ redis }))
// No request scope here: emails stay queued in the outbox.
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: () => {} }))

import { prisma } from '@/lib/db'
import { createBooking, createRoomType, createTenant, createUser, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { decryptSecret, secretContext } from '@/lib/security/secret-box'
import { getAccess, requireAccess } from '@/lib/auth/access'
import { PROPERTY_PLAN_LOCKED, ROOM_TYPE_NOT_BOOKABLE, ROOM_TYPE_PLAN_LOCKED, ONLINE_BOOKING_PAUSED } from './guard'
import { workspaceUsage } from './limits'
import { overageView, reconcileOverage } from './overage'
import { PATCH as patchPolicy, GET as getPolicy } from '@/app/api/properties/[id]/policy/route'
import { POST as guestBooking } from '@/app/api/public/bookings/route'
import { POST as holdRoom } from '@/app/api/bookings/room-lock/route'
import { GET as availability } from '@/app/api/bookings/availability/route'
import { GET as listBookings, POST as staffBooking } from '@/app/api/bookings/route'
import { POST as checkIn } from '@/app/api/bookings/[id]/check-in/route'
import { POST as moveRoom } from '@/app/api/bookings/[id]/room/route'
import { GET as listWorkspaces } from '@/app/api/workspaces/route'
import { POST as subscriptionJobs } from '@/app/api/internal/subscription-jobs/route'

const DAY = 86_400_000
const signInAs = (user: { id: string; email: string }) => {
  session.current = { user: { id: user.id, email: user.email } }
}
const post = (body: object, headers: Record<string, string> = {}) =>
  new NextRequest('http://digistay.test/api/x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } })
const patch = (body: object) =>
  new NextRequest('http://digistay.test/api/x', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const get = (url: string) => new NextRequest(`http://digistay.test${url}`)
const at = (id: string) => ({ params: Promise.resolve({ id }) })
const call = async (res: Response | Promise<Response>) => {
  const r = await res
  return { status: r.status, body: await r.json() }
}
let ip = 0
const freshIp = () => ({ 'x-real-ip': `203.0.113.${(++ip % 250) + 1}` })
/** yyyy-mm-dd, `n` days from now. */
const dayFromNow = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10)
const STAY = { checkInDate: dayFromNow(30), checkOutDate: dayFromNow(32) }

/** A paid plan running 20 more days (not a trial), optionally already over since `overLimitSince`. */
const onPlan = (workspaceId: string, plan: string, overLimitSince: Date | null = null) =>
  prisma.subscription.upsert({
    where: { workspaceId },
    create: { workspaceId, plan, billing: 'MONTH', trial: false, periodStart: new Date(Date.now() - 10 * DAY), periodEnd: new Date(Date.now() + 20 * DAY), overLimitSince },
    update: { plan, billing: 'MONTH', trial: false, periodStart: new Date(Date.now() - 10 * DAY), periodEnd: new Date(Date.now() + 20 * DAY), overLimitSince },
  })

const sinceOf = async (workspaceId: string) => (await prisma.subscription.findUniqueOrThrow({ where: { workspaceId } })).overLimitSince

async function emails(kind: string) {
  const rows = await prisma.emailOutbox.findMany({ where: { kind }, orderBy: { createdAt: 'asc' } })
  return rows.map((row) => {
    const { subject, text } = JSON.parse(decryptSecret(row.message, secretContext('email_outbox', row.id, 'message'))) as { subject: string; text: string }
    return { to: row.toEmail, subject, text }
  })
}

let seq = 0
const itemOf = (b: { id: string; checkInDate: Date; checkOutDate: Date }) => ({
  bookingId: b.id,
  checkInDate: b.checkInDate,
  checkOutDate: b.checkOutDate,
  basePrice: 500_000,
  totalPrice: 1_000_000,
})
async function addProperty(workspaceId: string, name: string, createdAt: Date) {
  const id = `${Date.now().toString(36)}${++seq}`
  return prisma.property.create({
    data: { workspaceId, name, slug: `p-${id}`, type: 'HOTEL', address: '1 Test Street', city: 'Da Lat', subdomain: `p-${id}`, createdAt },
  })
}
async function addMember(workspaceId: string, joinedAt: Date) {
  const user = await createUser()
  await prisma.workspaceMember.create({ data: { workspaceId, userId: user.id, role: 'RECEPTIONIST', joinedAt } })
  return user
}
const roomTypeAt = async (propertyId: string, name: string, totalRooms: number, createdAt: Date) => {
  const rt = await createRoomType(propertyId, { name, totalRooms })
  return prisma.roomType.update({ where: { id: rt.id }, data: { createdAt } })
}

/**
 * A Growth-sized workspace: 3 properties, 21 rooms in the first, 4 staff and
 * an open invitation; everything made in order, a minute apart.
 */
async function bigWorkspace() {
  const t0 = Date.now() - 60 * DAY
  const minute = (n: number) => new Date(t0 + n * 60_000)
  const { owner, workspace, property: first } = await createTenant()
  await prisma.property.update({ where: { id: first.id }, data: { createdAt: minute(0) } })
  const second = await addProperty(workspace.id, 'Second Hotel', minute(1))
  const third = await addProperty(workspace.id, 'Third Hotel', minute(2))
  const standard = await roomTypeAt(first.id, 'Standard', 10, minute(3))
  const deluxe = await roomTypeAt(first.id, 'Deluxe', 8, minute(4))
  const suite = await roomTypeAt(first.id, 'Suite', 3, minute(5))
  await roomTypeAt(second.id, 'Second Standard', 20, minute(6))
  const members = []
  for (let i = 0; i < 4; i++) members.push(await addMember(workspace.id, minute(10 + i)))
  const invitation = await prisma.invitation.create({
    data: { email: 'late@example.com', workspaceId: workspace.id, token: `tok-${Date.now()}-${++seq}`, senderId: owner.id, expiresAt: new Date(Date.now() + 5 * DAY), createdAt: minute(20) },
  })
  return { owner, workspace, first, second, third, standard, deluxe, suite, members, invitation }
}

beforeAll(() => {
  process.env.CRON_SECRET = 'c'.repeat(40)
})
beforeEach(async () => {
  await resetDatabase()
  redis.data.clear()
  session.current = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(() => prisma.$disconnect())

describe('the grace', () => {
  it('starts once, with one email to the owner, and locks nothing for 7 days', async () => {
    const w = await bigWorkspace()
    await onPlan(w.workspace.id, 'starter')
    const now = new Date()

    const first = await reconcileOverage(w.workspace.id, now)
    expect(first).toMatchObject({ started: true, locked: null })
    expect((await sinceOf(w.workspace.id))?.getTime()).toBe(now.getTime())
    const sent = await emails('plan_overage_grace')
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(w.owner.email)
    expect(sent[0].text).toContain('3/1 cơ sở')
    expect(sent[0].text).toContain('5/3 tài khoản nhân viên')
    const bell = await prisma.notification.findMany({ where: { userId: w.owner.id, type: 'plan_overage' } })
    expect(bell).toEqual([expect.objectContaining({ data: expect.objectContaining({ state: 'grace', plan: 'starter', over: ['properties', 'rooms', 'staff'] }) })])

    for (const later of [1, 3, 6.9]) {
      const again = await reconcileOverage(w.workspace.id, new Date(now.getTime() + later * DAY))
      expect(again).toMatchObject({ started: false, locked: null, cleared: false })
    }
    expect(await emails('plan_overage_grace')).toHaveLength(1)
    expect(await prisma.property.count({ where: { planLockedAt: { not: null } } })).toBe(0)
    expect((await overageView(w.workspace.id)).over).toEqual({
      properties: { used: 3, limit: 1 },
      rooms: { used: 41, limit: 15 },
      staff: { used: 5, limit: 3 },
    })
  })

  it('clears when the workspace fits again in time; nothing starts while it fits', async () => {
    const { workspace } = await createTenant()
    await onPlan(workspace.id, 'starter')
    expect(await reconcileOverage(workspace.id)).toMatchObject({ started: false, cleared: false })
    const extra = await addProperty(workspace.id, 'Extra', new Date())
    expect((await reconcileOverage(workspace.id)).started).toBe(true)
    await prisma.property.delete({ where: { id: extra.id } })
    expect((await reconcileOverage(workspace.id)).cleared).toBe(true)
    expect(await sinceOf(workspace.id)).toBeNull()
  })
})

describe('after 7 days', () => {
  it('locks the excess newest first, emails what was locked, and the usage then fits', async () => {
    const w = await bigWorkspace()
    await onPlan(w.workspace.id, 'starter', new Date(Date.now() - 8 * DAY))

    const outcome = await reconcileOverage(w.workspace.id)
    expect(outcome.locked).toMatchObject({ properties: [w.third.id, w.second.id], invitations: [w.invitation.id], members: [w.members[3].id] })
    // 21 rooms left for 15: Suite (3) is not enough, Deluxe (8) is; then Suite fits back.
    expect(outcome.locked?.roomTypes).toEqual([w.deluxe.id])
    expect(outcome.cleared).toBe(true)

    const locked = await prisma.property.findMany({ where: { planLockedAt: { not: null } }, select: { id: true } })
    expect(locked.map((p) => p.id).sort()).toEqual([w.second.id, w.third.id].sort())
    expect((await prisma.roomType.findUniqueOrThrow({ where: { id: w.deluxe.id } })).planLockedAt).not.toBeNull()
    expect((await prisma.roomType.findUniqueOrThrow({ where: { id: w.suite.id } })).planLockedAt).toBeNull()
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: w.invitation.id } })).status).toBe('EXPIRED')
    const member = await prisma.workspaceMember.findFirstOrThrow({ where: { userId: w.members[3].id } })
    expect(member.planLockedAt).not.toBeNull()
    // Nothing deleted.
    expect(await prisma.property.count({ where: { workspaceId: w.workspace.id } })).toBe(3)

    expect(await workspaceUsage(w.workspace.id)).toMatchObject({ properties: 1, rooms: 13, staff: 3 })
    expect(await sinceOf(w.workspace.id)).toBeNull()

    const [mail] = await emails('plan_overage_locked')
    expect(mail.to).toBe(w.owner.email)
    expect(mail.text).toContain('Second Hotel')
    expect(mail.text).toContain('Third Hotel')
    expect(mail.text).toContain('Deluxe')
    expect(mail.text).toContain('late@example.com')
    const bell = await prisma.notification.findFirstOrThrow({ where: { userId: w.owner.id, type: 'plan_overage' } })
    expect(bell.data).toMatchObject({ state: 'locked', locked: { properties: 2, roomTypes: 1, members: 1 } })

    const view = await overageView(w.workspace.id)
    expect(view).toMatchObject({ since: null, locksAt: null, over: {} })
    expect(view.locked.properties.map((p) => p.name).sort()).toEqual(['Second Hotel', 'Third Hotel'])
    expect(view.locked.roomTypes).toEqual([{ id: w.deluxe.id, name: 'Deluxe', propertyName: w.first.name, rooms: 8 }])
    expect(view.locked.members).toEqual([expect.objectContaining({ userId: w.members[3].id, email: w.members[3].email })])

    // A second run changes nothing and emails nothing more.
    expect(await reconcileOverage(w.workspace.id)).toEqual({ started: false, cleared: false, locked: null, unlocked: null })
    expect(await emails('plan_overage_locked')).toHaveLength(1)
  })

  it('unlocks everything that fits once the plan is bigger', async () => {
    const w = await bigWorkspace()
    await onPlan(w.workspace.id, 'starter', new Date(Date.now() - 8 * DAY))
    await reconcileOverage(w.workspace.id)

    await onPlan(w.workspace.id, 'growth')
    const outcome = await reconcileOverage(w.workspace.id)
    expect(outcome.unlocked?.properties.sort()).toEqual([w.second.id, w.third.id].sort())
    expect(outcome.unlocked?.roomTypes).toEqual([w.deluxe.id])
    expect(outcome.unlocked?.members).toEqual([w.members[3].id])
    expect(await prisma.property.count({ where: { planLockedAt: { not: null } } })).toBe(0)
    expect(await prisma.roomType.count({ where: { planLockedAt: { not: null } } })).toBe(0)
    expect(await prisma.workspaceMember.count({ where: { planLockedAt: { not: null } } })).toBe(0)
    expect(await workspaceUsage(w.workspace.id)).toMatchObject({ properties: 3, rooms: 41, staff: 4 })
    expect(await sinceOf(w.workspace.id)).toBeNull()
  })

  it('waits while the workspace itself is read-only, and starts again with a new period', async () => {
    const { workspace } = await createTenant()
    await addProperty(workspace.id, 'Extra', new Date())
    await prisma.subscription.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, plan: 'starter', trial: false, periodStart: new Date(Date.now() - 40 * DAY), periodEnd: new Date(Date.now() - 9 * DAY), overLimitSince: new Date(Date.now() - 20 * DAY) },
      update: {},
    })
    expect(await reconcileOverage(workspace.id)).toMatchObject({ cleared: true, locked: null })
    expect(await prisma.property.count({ where: { planLockedAt: { not: null } } })).toBe(0)
    await onPlan(workspace.id, 'starter')
    expect((await reconcileOverage(workspace.id)).started).toBe(true)
  })
})

describe('what a lock means', () => {
  async function lockedWorkspace() {
    const w = await bigWorkspace()
    await onPlan(w.workspace.id, 'starter', new Date(Date.now() - 8 * DAY))
    await reconcileOverage(w.workspace.id)
    return w
  }

  it("a locked property's write route answers 402 while another property works; reading stays", async () => {
    const w = await lockedWorkspace()
    signInAs(w.owner)
    const open = await call(patchPolicy(patch({ checkInTime: '15:00' }), at(w.first.id)))
    expect(open.status).toBe(200)
    const locked = await call(patchPolicy(patch({ checkInTime: '15:00' }), at(w.second.id)))
    expect(locked.status).toBe(402)
    expect(locked.body).toMatchObject({ code: 'PROPERTY_PLAN_LOCKED', error: PROPERTY_PLAN_LOCKED })
    expect((await getPolicy(get('/api/x'), at(w.second.id))).status).toBe(200)
  })

  it('guests cannot book or hold a locked room type, nor anything at a locked property; it shows as full', async () => {
    const w = await lockedWorkspace()
    await publishSite(w.first.id)
    await publishSite(w.second.id)
    const secondType = await prisma.roomType.findFirstOrThrow({ where: { propertyId: w.second.id } })
    const guest = { guestName: 'Lê Thị Hoa', guestEmail: 'hoa@example.com', guestPhone: '0912345678', numAdults: 2, numChildren: 0, ...STAY }

    const booked = await call(guestBooking(post({ propertyId: w.first.id, roomTypeId: w.deluxe.id, ...guest }, freshIp())))
    expect(booked).toMatchObject({ status: 403, body: { error: ROOM_TYPE_NOT_BOOKABLE } })
    const held = await call(holdRoom(post({ propertyId: w.first.id, roomTypeId: w.deluxe.id, ...STAY }, freshIp())))
    expect(held).toMatchObject({ status: 403, body: { error: ROOM_TYPE_NOT_BOOKABLE } })
    const atLocked = await call(guestBooking(post({ propertyId: w.second.id, roomTypeId: secondType.id, ...guest }, freshIp())))
    expect(atLocked).toMatchObject({ status: 403, body: { error: ONLINE_BOOKING_PAUSED } })

    // Another room type of the same hotel still books.
    const ok = await call(guestBooking(post({ propertyId: w.first.id, roomTypeId: w.standard.id, ...guest }, freshIp())))
    expect(ok.status).toBe(200)

    const shown = await call(availability(get(`/api/bookings/availability?propertyId=${w.first.id}&checkInDate=${STAY.checkInDate}&checkOutDate=${STAY.checkOutDate}&numAdults=2`)))
    const byId = new Map(shown.body.data.map((rt: { id: string; availableRooms: number }) => [rt.id, rt.availableRooms]))
    expect(byId.get(w.deluxe.id)).toBe(0)
    expect(byId.get(w.standard.id)).toBeGreaterThan(0)
  })

  it('staff cannot book or move a stay into a locked room type, but a stay already in it is checked in', async () => {
    const w = await lockedWorkspace()
    signInAs(w.owner)
    const staff = { propertyId: w.first.id, guestName: 'Khách', guestPhone: '0912345678', numAdults: 2, numChildren: 0, ...STAY }
    const refused = await call(staffBooking(post({ ...staff, roomTypeId: w.deluxe.id })))
    expect(refused).toMatchObject({ status: 409, body: { error: ROOM_TYPE_PLAN_LOCKED } })
    expect((await call(staffBooking(post({ ...staff, roomTypeId: w.standard.id })))).status).toBe(200)

    // Moving a Standard stay into a Deluxe room is refused.
    const [standardRoom, deluxeRoom] = await Promise.all([
      prisma.room.create({ data: { propertyId: w.first.id, roomTypeId: w.standard.id, number: '101' } }),
      prisma.room.create({ data: { propertyId: w.first.id, roomTypeId: w.deluxe.id, number: '201' } }),
    ])
    const stay = await createBooking(w.first.id, { status: 'CONFIRMED' })
    await prisma.bookingItem.create({ data: { ...itemOf(stay), roomTypeId: w.standard.id, roomId: standardRoom.id, roomNumber: '101' } })
    const moved = await call(moveRoom(post({ roomId: deluxeRoom.id }), at(stay.id)))
    expect(moved).toMatchObject({ status: 409, body: { error: ROOM_TYPE_PLAN_LOCKED } })

    // A guest already booked in Deluxe: put in a room of it and checked in.
    const deluxeStay = await createBooking(w.first.id, { status: 'CONFIRMED' })
    await prisma.bookingItem.create({ data: { ...itemOf(deluxeStay), roomTypeId: w.deluxe.id } })
    expect((await call(moveRoom(post({ roomId: deluxeRoom.id }), at(deluxeStay.id)))).status).toBe(200)
    const checkedIn = await call(checkIn(post({}), at(deluxeStay.id)))
    expect(checkedIn.status).toBe(200)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: deluxeStay.id } })).status).toBe('CHECKED_IN')
  })

  it('a locked member has no access to the workspace until unlocked, and their list says why', async () => {
    const w = await lockedWorkspace()
    const lockedUser = w.members[3]
    const openUser = w.members[0]
    expect((await getAccess(w.workspace.id, lockedUser.id))?.role ?? null).toBeNull()
    expect((await getAccess(w.workspace.id, openUser.id))?.role).toBe('RECEPTIONIST')

    signInAs(lockedUser)
    expect((await requireAccess(w.workspace.id, null)).ok).toBe(false)
    await createBooking(w.first.id)
    const list = await call(listBookings(get(`/api/bookings?propertyId=${w.first.id}`)))
    expect(list.body.data ?? []).toHaveLength(0)
    const policy = await getPolicy(get('/api/x'), at(w.first.id))
    expect(policy.status).toBeGreaterThanOrEqual(403)
    const workspaces = await call(listWorkspaces())
    expect(workspaces.body.data).toEqual([expect.objectContaining({ id: w.workspace.id, planLocked: true })])
    expect(workspaces.body.data[0].members).toHaveLength(1)

    signInAs(openUser)
    expect((await call(listBookings(get(`/api/bookings?propertyId=${w.first.id}`)))).body.data).toHaveLength(1)

    await onPlan(w.workspace.id, 'growth')
    await reconcileOverage(w.workspace.id)
    expect((await getAccess(w.workspace.id, lockedUser.id))?.role ?? null).toBe('RECEPTIONIST')
  })
})

describe('the plan jobs', () => {
  it('reconcile every workspace and report it with the reminders', async () => {
    const over = await createTenant()
    await onPlan(over.workspace.id, 'starter')
    await addProperty(over.workspace.id, 'Extra', new Date())
    const fits = await createTenant()
    await onPlan(fits.workspace.id, 'starter')

    const res = await call(subscriptionJobs(new NextRequest('http://digistay.test/api/internal/subscription-jobs', { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET! } })))
    expect(res.status).toBe(200)
    expect(res.body.data.reminders).toBeDefined()
    expect(res.body.data.overage).toMatchObject({ checked: 2, started: 1, failed: 0 })
    expect(res.body.data.usage).toMatchObject({ checked: 2 })
    expect(await sinceOf(over.workspace.id)).not.toBeNull()
    expect(await sinceOf(fits.workspace.id)).toBeNull()
  })
})
