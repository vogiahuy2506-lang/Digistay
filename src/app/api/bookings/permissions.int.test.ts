/**
 * The front desk's routes by permission (src/lib/auth/permissions.ts), not
 * role: a member with a ticked set may do what it holds and nothing else,
 * a member limited to some properties does not see the others' bookings (the
 * 404 of a missing one), a member locked by an admin has no access, and the
 * bell rings only for those with the permission there. Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Permission } from '@/lib/auth/permissions'
import {
  addMemberProperty,
  createBooking,
  createProperty,
  createRoomType,
  createTenant,
  createUser,
  resetDatabase,
} from '@/test/integration/fixtures'
import { createBooking as bookOnline } from '@/lib/bookings/create-booking'
import { queueGuestDepositReceived } from '@/lib/payments/deposit-received'
import { GET as listBookings } from './route'
import { GET as getBooking, DELETE as deleteBooking } from './[id]/route'
import { POST as checkIn } from './[id]/check-in/route'
import { GET as cancelPreview } from './[id]/cancel/route'
import { POST as sendConfirmation } from './[id]/send-confirmation/route'
import { GET as availableRooms } from '../rooms/available/route'
import { POST as addMaintenance } from '../rooms/maintenance/route'
import { POST as addRooms } from '../properties/[id]/rooms/route'
import { GET as timeline } from '../properties/[id]/timeline/route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

const req = (url: string, method = 'GET', body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    ...(body && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

const listIds = async (query = '') => {
  const res = await listBookings(req(`/api/bookings${query}`))
  return { status: res.status, ids: res.ok ? ((await res.json()).data as { id: string }[]).map((b) => b.id).sort() : [] }
}

/** A hotel with a member holding exactly `permissions` (normalized: acting on bookings brings seeing them). */
async function memberWith(permissions: Permission[]) {
  const tenant = await createTenant({ memberRole: 'USER', memberPermissions: permissions })
  return { ...tenant, member: tenant.member! }
}

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('a member with their own set of permissions', () => {
  it('bookings_view only: reads the booking and the list, cannot check in', async () => {
    const { property, member } = await memberWith(['bookings_view'])
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    signInAs(member)

    expect((await getBooking(req(`/api/bookings/${booking.id}`), params(booking.id))).status).toBe(200)
    expect(await listIds()).toEqual({ status: 200, ids: [booking.id] })
    expect(await listIds(`?propertyId=${property.id}`)).toEqual({ status: 200, ids: [booking.id] })

    const res = await checkIn(req(`/api/bookings/${booking.id}/check-in`, 'POST'), params(booking.id))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Không có quyền check-in')
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
  })

  it('bookings_edit: checks in', async () => {
    const { property, member } = await memberWith(['bookings_edit'])
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    signInAs(member)

    const res = await checkIn(req(`/api/bookings/${booking.id}/check-in`, 'POST'), params(booking.id))
    expect(res.status).toBe(200)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: 'CHECKED_IN',
      checkedInBy: member.id,
    })
  })

  it('without bookings_view: no booking, list or room plan', async () => {
    const { property, member } = await memberWith(['rooms_status'])
    const booking = await createBooking(property.id)
    signInAs(member)

    expect((await getBooking(req(`/api/bookings/${booking.id}`), params(booking.id))).status).toBe(403)
    expect(await listIds()).toEqual({ status: 200, ids: [] })
    expect((await listIds(`?propertyId=${property.id}`)).status).toBe(403)
    expect((await timeline(req(`/api/properties/${property.id}/timeline`), params(property.id))).status).toBe(403)
  })

  // Each route refuses a set without its permission (403) and lets in one with it.
  const CASES: [string, Permission, Permission[], (t: Awaited<ReturnType<typeof memberWith>>) => Promise<Response>][] = [
    [
      'GET cancel preview',
      'bookings_cancel',
      ['bookings_edit'],
      async ({ property }) => {
        const b = await createBooking(property.id, { status: 'CONFIRMED' })
        return cancelPreview(req(`/api/bookings/${b.id}/cancel`), params(b.id))
      },
    ],
    [
      'DELETE booking',
      'bookings_delete',
      ['bookings_edit', 'bookings_cancel'],
      async ({ property }) => {
        const b = await createBooking(property.id, { status: 'PENDING' })
        return deleteBooking(req(`/api/bookings/${b.id}`, 'DELETE'), params(b.id))
      },
    ],
    [
      'POST maintenance',
      'rooms_status',
      ['bookings_edit'],
      async ({ property }) => {
        const type = await createRoomType(property.id)
        return addMaintenance(
          req('/api/rooms/maintenance', 'POST', {
            propertyId: property.id,
            roomTypeId: type.id,
            startDate: '2026-12-01',
            endDate: '2026-12-02',
          })
        )
      },
    ],
    [
      'POST rooms',
      'rooms_manage',
      ['bookings_edit', 'rooms_status', 'room_types_manage'],
      async ({ property }) => {
        const type = await createRoomType(property.id, { totalRooms: 2 })
        return addRooms(req(`/api/properties/${property.id}/rooms`, 'POST', { roomTypeId: type.id, numbers: '101-102' }), params(property.id))
      },
    ],
    [
      'GET timeline',
      'bookings_view',
      ['rooms_status', 'rooms_manage'],
      async ({ property }) => timeline(req(`/api/properties/${property.id}/timeline`), params(property.id)),
    ],
  ]

  it.each(CASES)('%s needs %s', async (_name, permission, others, call) => {
    const without = await memberWith(others)
    signInAs(without.member)
    expect((await call(without)).status).toBe(403)

    const withIt = await memberWith([...others, permission])
    signInAs(withIt.member)
    expect((await call(withIt)).status).toBe(200)
  })

  it('sending the confirmation again needs bookings_edit', async () => {
    const { property, member } = await memberWith(['bookings_view', 'bookings_create'])
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    signInAs(member)
    expect((await sendConfirmation(req(`/api/bookings/${booking.id}/send-confirmation`, 'POST'), params(booking.id))).status).toBe(403)
  })
})

describe('a member limited to some properties', () => {
  async function twoHotels() {
    const tenant = await createTenant({ memberRole: 'RECEPTIONIST', memberLimited: true })
    const other = await createProperty(tenant.workspace.id)
    await addMemberProperty(tenant.workspace.id, tenant.member!.id, tenant.property.id)
    return { ...tenant, member: tenant.member!, other }
  }

  it("works on their property; the other's bookings are a 404 and absent from the list", async () => {
    const { workspace, property, other, member } = await twoHotels()
    const mine = await createBooking(property.id, { status: 'CONFIRMED' })
    const theirs = await createBooking(other.id, { status: 'CONFIRMED' })
    signInAs(member)

    expect((await getBooking(req(`/api/bookings/${mine.id}`), params(mine.id))).status).toBe(200)
    const res = await getBooking(req(`/api/bookings/${theirs.id}`), params(theirs.id))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Không tìm thấy đơn đặt phòng')
    expect((await checkIn(req(`/api/bookings/${theirs.id}/check-in`, 'POST'), params(theirs.id))).status).toBe(404)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe('CONFIRMED')

    expect(await listIds()).toEqual({ status: 200, ids: [mine.id] })
    expect(await listIds(`?workspaceId=${workspace.id}`)).toEqual({ status: 200, ids: [mine.id] })
    expect((await listIds(`?propertyId=${other.id}`)).status).toBe(403)
  })

  it("the other property's rooms and room plan are a 404", async () => {
    const { other, member } = await twoHotels()
    const type = await createRoomType(other.id)
    signInAs(member)

    expect((await timeline(req(`/api/properties/${other.id}/timeline`), params(other.id))).status).toBe(404)
    const available = await availableRooms(
      req(`/api/rooms/available?propertyId=${other.id}&roomTypeId=${type.id}&checkIn=2026-12-01&checkOut=2026-12-02`)
    )
    expect(available.status).toBe(404)
  })
})

describe('a member locked by an admin', () => {
  it('has no access at all', async () => {
    const { workspace, property, member } = await createTenant({ memberRole: 'ADMIN' })
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: member!.id } },
      data: { disabledAt: new Date() },
    })
    signInAs(member!)

    expect((await getBooking(req(`/api/bookings/${booking.id}`), params(booking.id))).status).toBe(404)
    expect((await checkIn(req(`/api/bookings/${booking.id}/check-in`, 'POST'), params(booking.id))).status).toBe(404)
    expect(await listIds()).toEqual({ status: 200, ids: [] })
    expect((await listIds(`?propertyId=${property.id}`)).status).toBe(403)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
  })
})

describe('who hears about it', () => {
  async function hotel() {
    const tenant = await createTenant()
    const { workspace, property } = tenant
    const other = await createProperty(workspace.id)
    const add = async (data: { role?: 'ADMIN' | 'RECEPTIONIST' | 'USER'; permissions?: Permission[]; onlyOther?: boolean; disabled?: boolean }) => {
      const user = await createUser()
      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: data.role ?? 'USER',
          ...(data.permissions && { customPermissions: true, permissions: data.permissions }),
          ...(data.onlyOther && { allProperties: false, properties: { create: { propertyId: other.id } } }),
          ...(data.disabled && { disabledAt: new Date() }),
        },
      })
      return user.id
    }
    const people = {
      desk: await add({ permissions: ['bookings_edit'] }),
      cashier: await add({ permissions: ['payments_manage'] }),
      viewer: await add({ permissions: ['bookings_view'] }),
      settings: await add({ permissions: ['workspace_settings'] }),
      otherHotel: await add({ role: 'ADMIN', onlyOther: true }),
      disabled: await add({ role: 'ADMIN', disabled: true }),
    }
    const room = await createRoomType(property.id, { totalRooms: 5 })
    return { ...tenant, people, room }
  }

  const book = (propertyId: string, roomTypeId: string, createdById: string | null) =>
    bookOnline({
      propertyId,
      roomTypeId,
      guestName: 'Ngô Thị Chuông',
      guestEmail: 'chuong@example.com',
      guestPhone: '0900000020',
      checkIn: new Date('2026-12-10T00:00:00+07:00'),
      checkOut: new Date('2026-12-12T00:00:00+07:00'),
      numAdults: 2,
      numChildren: 0,
      createdById,
    })

  const recipients = async (type: string) =>
    (await prisma.notification.findMany({ where: { type }, select: { userId: true } })).map((n) => n.userId).sort()

  it('only the owner and members with the permission on that property', async () => {
    const { owner, people, property, room } = await hotel()

    // From the website: bookings_edit.
    const { booking } = await book(property.id, room.id, null)
    expect(await recipients('booking_new')).toEqual([owner.id, people.desk].sort())

    // A paid deposit: payments_manage (which brings bookings_view).
    await prisma.$transaction((tx) =>
      queueGuestDepositReceived(tx, { bookingId: booking.id, amount: 300_000, metadata: { guestDeposit: true } }, false)
    )
    expect(await recipients('deposit_paid')).toEqual([owner.id, people.cashier].sort())

    // Made by staff: workspace_settings, never the one who made it.
    await prisma.notification.deleteMany()
    await book(property.id, room.id, people.desk)
    expect(await recipients('booking_new')).toEqual([owner.id, people.settings].sort())
  })
})
