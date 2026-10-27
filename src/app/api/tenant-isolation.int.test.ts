/**
 * Cross-tenant isolation against real Postgres (audit 2026-10-20). Every id
 * a client sends (path, query or body) must belong to the caller's
 * workspace; a request naming another hotel's row fails and leaves that row
 * as it was. Tests act as workspace B against workspace A.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
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
      async get(key: string) {
        return data.get(key) ?? null
      },
      async del(key: string) {
        return data.delete(key) ? 1 : 0
      },
    },
  }
})
vi.mock('@/lib/db/redis', () => ({ redis: store.redis }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PUT as putBlocks } from './website/blocks/route'
import { PATCH as patchMember, DELETE as deleteMember } from './workspaces/[id]/members/[memberId]/route'
import { GET as listInvoices } from './invoices/route'
import { GET as getInvoice } from './invoices/[id]/route'
import { GET as listBankAccounts } from './bank-accounts/route'
import { POST as lockRoom, DELETE as releaseLock } from './bookings/room-lock/route'
import { POST as createMaintenance, DELETE as deleteMaintenance } from './rooms/maintenance/route'
import { GET as availableRooms } from './rooms/available/route'
import { POST as createAmenity } from './amenities/route'
import {
  addMemberProperty,
  createBooking,
  createProperty,
  createRoomType,
  createTenant,
  createUser,
  resetDatabase,
} from '@/test/integration/fixtures'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>

function signInAs(user: { id: string; email: string } | null) {
  mockAuth.mockResolvedValue(user ? { user: { id: user.id, email: user.email } } : null)
}

function req(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
}

function params<T>(value: T) {
  return { params: Promise.resolve(value) }
}

async function ids(res: Response) {
  expect(res.status).toBe(200)
  return ((await res.json()).data as { id: string }[]).map((row) => row.id).sort()
}

/** Hotel A (owner + a USER member) and hotel B, in two workspaces. */
async function twoTenants() {
  const a = await createTenant({ memberRole: 'USER' })
  const b = await createTenant()
  return { a, b }
}

const stay = { checkInDate: '2026-11-10T14:00:00.000Z', checkOutDate: '2026-11-12T12:00:00.000Z' }

function createLock(propertyId: string, roomTypeId: string, type: 'HOLD' | 'BOOKED' | 'MAINTENANCE') {
  return prisma.roomLock.create({
    data: {
      propertyId,
      roomTypeId,
      type,
      lockStart: new Date(stay.checkInDate),
      lockEnd: new Date(stay.checkOutDate),
      expiresAt: type === 'MAINTENANCE' ? null : new Date(Date.now() + 15 * 60_000),
    },
  })
}

function createInvoice(booking: { id: string; propertyId: string }) {
  return prisma.invoice.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      invoiceNumber: `INV-${booking.id}`,
      companyName: 'Công ty A',
      companyAddress: '1 Đường A',
      taxCode: '0101234567',
      customerName: 'Khách A',
      customerEmail: 'khach-a@example.com',
      subtotal: 1_000_000,
      taxAmount: 100_000,
      totalAmount: 1_100_000,
    },
  })
}

beforeEach(async () => {
  store.data.clear()
  await resetDatabase()
})
afterAll(() => prisma.$disconnect())

describe('PUT /api/website/blocks', () => {
  async function seedBlocks(propertyId: string) {
    await prisma.websiteBlock.createMany({
      data: [
        { propertyId, type: 'HERO', name: 'Hero' },
        { propertyId, type: 'ROOMS', name: 'Rooms', sortOrder: 1 },
      ],
    })
  }
  const blockCount = (propertyId: string) => prisma.websiteBlock.count({ where: { propertyId } })

  it('a body without propertyId deletes nothing', async () => {
    const { a, b } = await twoTenants()
    await seedBlocks(a.property.id)
    signInAs(b.owner)

    const res = await putBlocks(req('/api/website/blocks', 'PUT', { blocks: [] }))

    expect(res.status).toBe(400)
    expect(await blockCount(a.property.id)).toBe(2)
  })

  it('a propertyId filter object cannot reach another hotel', async () => {
    const { a, b } = await twoTenants()
    await seedBlocks(a.property.id)
    signInAs(b.owner)

    const res = await putBlocks(
      req('/api/website/blocks', 'PUT', { propertyId: { in: [b.property.id, a.property.id] }, blocks: [] })
    )

    expect(res.status).toBe(400)
    expect(await blockCount(a.property.id)).toBe(2)
  })

  it("another hotel's propertyId is refused", async () => {
    const { a, b } = await twoTenants()
    await seedBlocks(a.property.id)
    signInAs(b.owner)

    const res = await putBlocks(req('/api/website/blocks', 'PUT', { propertyId: a.property.id, blocks: [] }))

    expect(res.status).toBe(403)
    expect(await blockCount(a.property.id)).toBe(2)
  })

  it('an invalid block leaves the current layout in place', async () => {
    const { a } = await twoTenants()
    await seedBlocks(a.property.id)
    signInAs(a.owner)

    const res = await putBlocks(
      req('/api/website/blocks', 'PUT', {
        propertyId: a.property.id,
        blocks: [
          { type: 'HERO', name: 'Hero' },
          { type: 'NOT_A_BLOCK', name: 'x' },
        ],
      })
    )

    expect(res.status).toBe(400)
    expect(await blockCount(a.property.id)).toBe(2)
  })

  it('a database error while saving keeps the current layout', async () => {
    const { a } = await twoTenants()
    await seedBlocks(a.property.id)
    signInAs(a.owner)

    // Valid to the schema, refused by Postgres (NUL in text) after the delete ran
    const res = await putBlocks(
      req('/api/website/blocks', 'PUT', { propertyId: a.property.id, blocks: [{ type: 'HERO', name: 'Hero\u0000' }] })
    )

    expect(res.status).toBe(500)
    expect(await blockCount(a.property.id)).toBe(2)
  })

  it("replaces the caller's own blocks", async () => {
    const { a } = await twoTenants()
    await seedBlocks(a.property.id)
    signInAs(a.owner)

    const res = await putBlocks(
      req('/api/website/blocks', 'PUT', {
        propertyId: a.property.id,
        blocks: [{ type: 'CONTACT', name: 'Liên hệ', config: { phone: '0900' }, isEnabled: false }],
      })
    )

    expect(res.status).toBe(200)
    const blocks = await prisma.websiteBlock.findMany({ where: { propertyId: a.property.id } })
    expect(blocks.map((block) => [block.type, block.isEnabled, block.sortOrder, block.config])).toEqual([
      ['CONTACT', false, 0, { phone: '0900' }],
    ])
  })
})

describe('PATCH/DELETE /api/workspaces/[id]/members/[memberId]', () => {
  const membershipOf = (workspaceId: string, userId: string) =>
    prisma.workspaceMember.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId, userId } } })

  it('a member cannot promote themselves through a workspace they own', async () => {
    const { a } = await twoTenants()
    const membership = await membershipOf(a.workspace.id, a.member!.id)
    const own = await prisma.workspace.create({
      data: { name: 'Mine', slug: `mine-${membership.id}`, ownerId: a.member!.id },
    })
    signInAs(a.member!)

    const res = await patchMember(
      req(`/api/workspaces/${own.id}/members/${membership.id}`, 'PATCH', { role: 'ADMIN' }),
      params({ id: own.id, memberId: membership.id })
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Không tìm thấy thành viên')
    expect((await membershipOf(a.workspace.id, a.member!.id)).role).toBe('USER')
  })

  it("an admin cannot remove another workspace's member", async () => {
    const { a, b } = await twoTenants()
    const membership = await membershipOf(a.workspace.id, a.member!.id)
    signInAs(b.owner)

    const res = await deleteMember(
      req(`/api/workspaces/${b.workspace.id}/members/${membership.id}`, 'DELETE'),
      params({ id: b.workspace.id, memberId: membership.id })
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Không tìm thấy thành viên')
    expect(await prisma.workspaceMember.count({ where: { id: membership.id } })).toBe(1)
  })

  it('an unknown role is refused', async () => {
    const { a } = await twoTenants()
    const membership = await membershipOf(a.workspace.id, a.member!.id)
    signInAs(a.owner)

    const res = await patchMember(
      req(`/api/workspaces/${a.workspace.id}/members/${membership.id}`, 'PATCH', { role: 'OWNER' }),
      params({ id: a.workspace.id, memberId: membership.id })
    )

    expect(res.status).toBe(400)
    expect((await membershipOf(a.workspace.id, a.member!.id)).role).toBe('USER')
  })

  it("the owner changes and removes their own workspace's members", async () => {
    const { a } = await twoTenants()
    const membership = await membershipOf(a.workspace.id, a.member!.id)
    signInAs(a.owner)

    const patched = await patchMember(
      req(`/api/workspaces/${a.workspace.id}/members/${membership.id}`, 'PATCH', { role: 'MANAGER' }),
      params({ id: a.workspace.id, memberId: membership.id })
    )
    expect(patched.status).toBe(200)
    expect((await membershipOf(a.workspace.id, a.member!.id)).role).toBe('MANAGER')

    const removed = await deleteMember(
      req(`/api/workspaces/${a.workspace.id}/members/${membership.id}`, 'DELETE'),
      params({ id: a.workspace.id, memberId: membership.id })
    )
    expect(removed.status).toBe(200)
    expect(await prisma.workspaceMember.count({ where: { id: membership.id } })).toBe(0)
  })
})

describe('GET /api/invoices and /api/invoices/[id]', () => {
  it("lists only the caller's invoices, with or without propertyId", async () => {
    const { a, b } = await twoTenants()
    const invoiceA = await createInvoice(await createBooking(a.property.id))
    const invoiceB = await createInvoice(await createBooking(b.property.id))

    signInAs(b.owner)
    expect(await ids(await listInvoices(req('/api/invoices')))).toEqual([invoiceB.id])
    expect(await ids(await listInvoices(req(`/api/invoices?propertyId=${a.property.id}`)))).toEqual([])

    // A's staff who issue invoices (invoices_manage: a receptionist) see A's;
    // its USER member, without it, none.
    const receptionist = await createUser()
    await prisma.workspaceMember.create({ data: { workspaceId: a.workspace.id, userId: receptionist.id, role: 'RECEPTIONIST' } })
    signInAs(receptionist)
    expect(await ids(await listInvoices(req('/api/invoices')))).toEqual([invoiceA.id])
    signInAs(a.member!)
    expect(await ids(await listInvoices(req('/api/invoices')))).toEqual([])

    signInAs(await createUser())
    expect(await ids(await listInvoices(req('/api/invoices')))).toEqual([])
  })

  it("another hotel's invoice is not found", async () => {
    const { a, b } = await twoTenants()
    const invoiceA = await createInvoice(await createBooking(a.property.id))

    signInAs(b.owner)
    const foreign = await getInvoice(req(`/api/invoices/${invoiceA.id}`), params({ id: invoiceA.id }))
    expect(foreign.status).toBe(404)

    signInAs(a.owner)
    const own = await getInvoice(req(`/api/invoices/${invoiceA.id}`), params({ id: invoiceA.id }))
    expect(own.status).toBe(200)
    expect((await own.json()).data.taxCode).toBe('0101234567')
  })
})

describe('GET /api/bank-accounts', () => {
  it("lists only the caller's accounts, with or without propertyId", async () => {
    const { a, b } = await twoTenants()
    const account = (propertyId: string) =>
      prisma.bankAccount.create({
        data: { propertyId, bankName: 'VCB', bankCode: 'VCB', accountNumber: '0123456789', accountHolder: 'NGUYEN VAN A' },
      })
    const accountA = await account(a.property.id)
    const accountB = await account(b.property.id)

    signInAs(b.owner)
    expect(await ids(await listBankAccounts(req('/api/bank-accounts')))).toEqual([accountB.id])
    expect(await ids(await listBankAccounts(req(`/api/bank-accounts?propertyId=${a.property.id}`)))).toEqual([])

    signInAs(a.member!)
    expect(await ids(await listBankAccounts(req('/api/bank-accounts')))).toEqual([accountA.id])
  })
})

describe('a member limited to one hotel of the workspace', () => {
  it("lists only that hotel's invoices and bank accounts, and cannot change the other's website", async () => {
    const { workspace, property: a, member } = await createTenant({ memberRole: 'MANAGER', memberLimited: true })
    await addMemberProperty(workspace.id, member!.id, a.id)
    const b = await createProperty(workspace.id)
    const invoiceA = await createInvoice(await createBooking(a.id))
    await createInvoice(await createBooking(b.id))
    const account = (propertyId: string) =>
      prisma.bankAccount.create({
        data: { propertyId, bankName: 'VCB', bankCode: 'VCB', accountNumber: '0123456789', accountHolder: 'NGUYEN VAN A' },
      })
    const accountA = await account(a.id)
    await account(b.id)
    await prisma.websiteBlock.create({ data: { propertyId: b.id, type: 'HERO', name: 'Hero' } })
    signInAs(member!)

    expect(await ids(await listInvoices(req('/api/invoices')))).toEqual([invoiceA.id])
    expect(await ids(await listInvoices(req(`/api/invoices?propertyId=${b.id}`)))).toEqual([])
    expect(await ids(await listBankAccounts(req('/api/bank-accounts')))).toEqual([accountA.id])

    const res = await putBlocks(req('/api/website/blocks', 'PUT', { propertyId: b.id, blocks: [] }))
    expect(res.status).toBe(403)
    expect(await prisma.websiteBlock.count({ where: { propertyId: b.id } })).toBe(1)
  })
})

describe('room locks', () => {
  it('the public release endpoint only releases holds', async () => {
    const { a } = await twoTenants()
    const roomType = await createRoomType(a.property.id)
    const maintenance = await createLock(a.property.id, roomType.id, 'MAINTENANCE')
    const booked = await createLock(a.property.id, roomType.id, 'BOOKED')
    const hold = await createLock(a.property.id, roomType.id, 'HOLD')

    for (const lock of [maintenance, booked]) {
      const res = await releaseLock(req(`/api/bookings/room-lock?lockId=${lock.id}`, 'DELETE'))
      expect(res.status).toBe(404)
    }
    const released = await releaseLock(req(`/api/bookings/room-lock?lockId=${hold.id}`, 'DELETE'))
    expect(released.status).toBe(200)

    const left = await prisma.roomLock.findMany({ select: { id: true } })
    expect(left.map((lock) => lock.id).sort()).toEqual([maintenance.id, booked.id].sort())
  })

  it("a hold cannot use another hotel's room type or booking", async () => {
    const { a, b } = await twoTenants()
    const roomTypeA = await createRoomType(a.property.id)
    const roomTypeB = await createRoomType(b.property.id)
    const bookingA = await createBooking(a.property.id)

    const foreign = await lockRoom(
      req('/api/bookings/room-lock', 'POST', { propertyId: b.property.id, roomTypeId: roomTypeA.id, ...stay })
    )
    expect(foreign.status).toBe(404)
    expect(await prisma.roomLock.count()).toBe(0)

    const own = await lockRoom(
      req('/api/bookings/room-lock', 'POST', {
        propertyId: b.property.id,
        roomTypeId: roomTypeB.id,
        bookingId: bookingA.id,
        ...stay,
      })
    )
    expect(own.status).toBe(200)
    const lock = await prisma.roomLock.findFirstOrThrow()
    expect([lock.propertyId, lock.roomTypeId, lock.bookingId]).toEqual([b.property.id, roomTypeB.id, null])
  })

  it("a maintenance block cannot use another hotel's room type", async () => {
    const { a, b } = await twoTenants()
    const roomTypeA = await createRoomType(a.property.id)
    signInAs(b.owner)

    const res = await createMaintenance(
      req('/api/rooms/maintenance', 'POST', {
        propertyId: b.property.id,
        roomTypeId: roomTypeA.id,
        startDate: stay.checkInDate,
        endDate: stay.checkOutDate,
      })
    )

    expect(res.status).toBe(404)
    expect(await prisma.roomLock.count()).toBe(0)
  })

  it("deleting goes by the lock's own hotel and removes only maintenance blocks", async () => {
    const { a, b } = await twoTenants()
    const roomTypeB = await createRoomType(b.property.id)
    // Written before room types were checked: hotel A's lock on B's room type.
    const mismatched = await createLock(a.property.id, roomTypeB.id, 'MAINTENANCE')
    const holdB = await createLock(b.property.id, roomTypeB.id, 'HOLD')
    signInAs(b.owner)

    for (const lock of [mismatched, holdB]) {
      const res = await deleteMaintenance(req(`/api/rooms/maintenance?lockId=${lock.id}`, 'DELETE'))
      expect(res.status).toBe(404)
    }

    expect(await prisma.roomLock.count()).toBe(2)
    expect(await prisma.activityLog.count({ where: { propertyId: a.property.id } })).toBe(0)
  })

  it('staff add and remove their own maintenance block', async () => {
    const { a } = await twoTenants()
    const roomType = await createRoomType(a.property.id)
    signInAs(a.owner)

    const created = await createMaintenance(
      req('/api/rooms/maintenance', 'POST', {
        propertyId: a.property.id,
        roomTypeId: roomType.id,
        startDate: stay.checkInDate,
        endDate: stay.checkOutDate,
      })
    )
    expect(created.status).toBe(200)
    const { data } = await created.json()

    const removed = await deleteMaintenance(req(`/api/rooms/maintenance?lockId=${data.id}`, 'DELETE'))
    expect(removed.status).toBe(200)
    expect(await prisma.roomLock.count()).toBe(0)
  })
})

describe('GET /api/rooms/available', () => {
  const query = (propertyId: string, roomTypeId: string) =>
    req(`/api/rooms/available?propertyId=${propertyId}&roomTypeId=${roomTypeId}&checkIn=2026-11-10&checkOut=2026-11-12`)

  it('needs a session', async () => {
    const { a } = await twoTenants()
    const roomType = await createRoomType(a.property.id)
    signInAs(null)

    expect((await availableRooms(query(a.property.id, roomType.id))).status).toBe(401)
  })

  it("does not answer for another hotel or another hotel's room type", async () => {
    const { a, b } = await twoTenants()
    const roomTypeA = await createRoomType(a.property.id)
    const roomTypeB = await createRoomType(b.property.id)
    signInAs(b.owner)

    expect((await availableRooms(query(a.property.id, roomTypeA.id))).status).toBe(404)
    expect((await availableRooms(query(b.property.id, roomTypeA.id))).status).toBe(404)
    expect((await availableRooms(query(b.property.id, roomTypeB.id))).status).toBe(200)
  })

  it("does not mix two properties of one workspace (room type of one, bookings of the other)", async () => {
    const { a } = await twoTenants()
    const second = await prisma.property.create({
      data: {
        workspaceId: a.workspace.id,
        name: 'Second hotel',
        slug: `second-${a.property.id}`,
        type: 'HOTEL',
        address: '2 Test Street',
        city: 'Da Lat',
        subdomain: `second-${a.property.id}`.toLowerCase().slice(0, 40),
      },
    })
    const roomTypeOfSecond = await createRoomType(second.id)
    signInAs(a.owner)

    expect((await availableRooms(query(a.property.id, roomTypeOfSecond.id))).status).toBe(404)
    expect((await availableRooms(query(second.id, roomTypeOfSecond.id))).status).toBe(200)
  })
})

describe('POST /api/amenities', () => {
  it('only a platform super admin adds to the list every hotel shares', async () => {
    const { a } = await twoTenants()
    const amenity = { name: 'Hồ bơi vô cực', category: 'general' }

    signInAs(a.owner)
    const refused = await createAmenity(req('/api/amenities', 'POST', amenity))
    expect(refused.status).toBe(403)
    expect(await prisma.amenity.count()).toBe(0)

    const superAdmin = await prisma.user.create({ data: { email: `sa-${a.owner.id}@example.com`, role: 'SUPER_ADMIN' } })
    signInAs(superAdmin)
    const created = await createAmenity(req('/api/amenities', 'POST', amenity))
    expect(created.status).toBe(200)
    expect(await prisma.amenity.count()).toBe(1)
  })
})
