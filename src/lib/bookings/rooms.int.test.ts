/**
 * A room number is one room (src/lib/bookings/rooms.ts): giving a stay a
 * room that another active stay holds on one of its nights is refused, in
 * the booking panel (PATCH /api/bookings/[id]) and when staff create a
 * booking with a room. Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), authOptions: {} }))
// The room type route reads the session through next-auth directly.
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { auth } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { createBooking as createFixtureBooking, createRoomType, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { createBooking } from './create-booking'
import { PATCH } from '@/app/api/bookings/[id]/route'

const signInAs = (user: { id: string; email: string }) => {
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
}

/** A booking of the hotel for [checkIn, checkOut) (yyyy-mm-dd, Vietnam days). */
async function stay(propertyId: string, roomTypeId: string, checkIn: string, checkOut: string, status: 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN' = 'CONFIRMED') {
  const booking = await createFixtureBooking(propertyId, { status })
  return prisma.booking.update({
    where: { id: booking.id },
    data: {
      checkInDate: new Date(`${checkIn}T00:00:00+07:00`),
      checkOutDate: new Date(`${checkOut}T00:00:00+07:00`),
      bookingItems: {
        create: {
          roomTypeId,
          checkInDate: new Date(`${checkIn}T00:00:00+07:00`),
          checkOutDate: new Date(`${checkOut}T00:00:00+07:00`),
          basePrice: 1,
          totalPrice: 1,
        },
      },
    },
  })
}

const setRoom = async (bookingId: string, roomNumber: string) => {
  const res = await PATCH(
    new NextRequest(`http://digistay.test/api/bookings/${bookingId}`, { method: 'PATCH', body: JSON.stringify({ roomNumber }) }),
    { params: Promise.resolve({ id: bookingId }) }
  )
  return { status: res.status, body: await res.json() }
}

const roomOf = async (bookingId: string) => (await prisma.bookingItem.findFirstOrThrow({ where: { bookingId } })).roomNumber

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('typed room numbers', () => {
  it('refuses a room another stay holds on one of the nights, whatever its type or the case', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const standard = await createRoomType(property.id, { name: 'Standard' })
    const deluxe = await createRoomType(property.id, { name: 'Deluxe' })
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-13')
    const b = await stay(property.id, deluxe.id, '2026-12-12', '2026-12-14')

    expect((await setRoom(a.id, 'A101')).status).toBe(200)
    const refused = await setRoom(b.id, ' a101 ')
    expect(refused.status).toBe(409)
    // Kept upper-case: "a101" and "A101" are one room.
    expect(refused.body.error).toBe(`Phòng A101 đã có đơn ${a.bookingCode} (10/12/2026 – 13/12/2026)`)
    expect(await roomOf(b.id)).toBeNull()

    // A stay keeps its own room when saved again.
    expect((await setRoom(a.id, 'A101')).status).toBe(200)
  })

  it('a check-out day is free for the next check-in; cancelled stays hold nothing', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id)
    const a = await stay(property.id, type.id, '2026-12-10', '2026-12-12')
    const next = await stay(property.id, type.id, '2026-12-12', '2026-12-13')
    const gone = await stay(property.id, type.id, '2026-12-10', '2026-12-12', 'CANCELLED')
    const overlapping = await stay(property.id, type.id, '2026-12-11', '2026-12-12')

    expect((await setRoom(gone.id, '201')).status).toBe(200)
    expect((await setRoom(a.id, '201')).status).toBe(200)
    expect((await setRoom(next.id, '201')).status).toBe(200)
    expect((await setRoom(overlapping.id, '201')).status).toBe(409)
  })

  it('two people giving out the same room at once: one wins', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id)
    for (let round = 0; round < 3; round++) {
      const x = await stay(property.id, type.id, '2026-12-20', '2026-12-22')
      const y = await stay(property.id, type.id, '2026-12-21', '2026-12-23')
      const statuses = (await Promise.all([setRoom(x.id, `30${round}`), setRoom(y.id, `30${round}`)])).map((r) => r.status).sort()
      expect(statuses).toEqual([200, 409])
    }
  })

  it('staff creating a booking with a room already taken are refused', async () => {
    const { owner, property } = await createTenant()
    const type = await createRoomType(property.id, { totalRooms: 5 })
    const a = await stay(property.id, type.id, '2026-12-10', '2026-12-12')
    await prisma.bookingItem.updateMany({ where: { bookingId: a.id }, data: { roomNumber: '401' } })

    const make = (roomNumber: string) =>
      createBooking({
        propertyId: property.id,
        roomTypeId: type.id,
        guestName: 'Khách Walk-in',
        guestEmail: '',
        guestPhone: '0900000030',
        checkIn: new Date('2026-12-11T00:00:00+07:00'),
        checkOut: new Date('2026-12-12T00:00:00+07:00'),
        numAdults: 1,
        numChildren: 0,
        roomNumber,
        createdById: owner.id,
      })
    await expect(make('401')).rejects.toThrow(`Phòng 401 đã có đơn ${a.bookingCode}`)
    const { booking } = await make('402')
    expect(await roomOf(booking.id)).toBe('402')
  })
})

// ---------------------------------------------------------------------------
// Listed rooms (task 25 / 27): the hotel's numbered rooms, assigning and
// moving stays, maintenance of one room, the timeline.

import { POST as addRooms } from '@/app/api/properties/[id]/rooms/route'
import { PATCH as patchRoom, DELETE as deleteRoom } from '@/app/api/rooms/[id]/route'
import { POST as assignRoute } from '@/app/api/bookings/[id]/room/route'
import { POST as maintenanceRoute } from '@/app/api/rooms/maintenance/route'
import { GET as timelineRoute } from '@/app/api/properties/[id]/timeline/route'
import { createUser } from '@/test/integration/fixtures'
import { parseRoomNumbers } from './rooms'

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://digistay.test${url}`, { method, ...(body !== undefined && { body: JSON.stringify(body) }) })
const add = async (propertyId: string, roomTypeId: string, numbers: string) => {
  const res = await addRooms(json(`/api/properties/${propertyId}/rooms`, 'POST', { roomTypeId, numbers }), { params: Promise.resolve({ id: propertyId }) })
  return { status: res.status, body: await res.json() }
}
const assign = async (bookingId: string, roomId: string | null) => {
  const res = await assignRoute(json(`/api/bookings/${bookingId}/room`, 'POST', { roomId }), { params: Promise.resolve({ id: bookingId }) })
  return { status: res.status, body: await res.json() }
}
const roomId = async (propertyId: string, number: string) => (await prisma.room.findFirstOrThrow({ where: { propertyId, number } })).id
const total = async (roomTypeId: string) => (await prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId } })).totalRooms

describe('parseRoomNumbers', () => {
  it('reads ranges and lists, upper-cased, without repeats', () => {
    expect(parseRoomNumbers('101-103, 201;a12\n201')).toEqual(['101', '102', '103', '201', 'A12'])
    expect(parseRoomNumbers('009-011')).toEqual(['009', '010', '011'])
    expect(parseRoomNumbers('110-101')).toBeNull()
    expect(parseRoomNumbers('1-500')).toBeNull()
    expect(parseRoomNumbers('  ')).toBeNull()
  })
})

describe('listing rooms', () => {
  it("adds rooms, refuses numbers the hotel has, and the type's count follows its active rooms", async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id, { totalRooms: 20 })
    expect((await add(property.id, type.id, '101-105')).status).toBe(200)
    expect(await total(type.id)).toBe(5)
    const again = await add(property.id, type.id, '105-106')
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('Khách sạn đã có phòng 105')
    expect(await prisma.room.count({ where: { roomTypeId: type.id } })).toBe(5)

    // A count typed on the room type no longer applies.
    const { PUT: putType } = await import('@/app/api/room-types/[id]/route')
    const typed = await putType(json(`/api/room-types/${type.id}`, 'PUT', { totalRooms: 9 }), { params: Promise.resolve({ id: type.id }) })
    expect(typed.status).toBe(400)

    const off = await patchRoom(json('/api/rooms/x', 'PATCH', { isActive: false }), { params: Promise.resolve({ id: await roomId(property.id, '105') }) })
    expect(off.status).toBe(200)
    expect(await total(type.id)).toBe(4)
  })

  it('never lists fewer rooms than a future night already sold', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id, { totalRooms: 3 })
    for (let i = 0; i < 3; i++) await stay(property.id, type.id, '2026-12-10', '2026-12-12')
    const short = await add(property.id, type.id, '101-102')
    expect(short.status).toBe(409)
    expect(await prisma.room.count({ where: { roomTypeId: type.id } })).toBe(0)
    expect(await total(type.id)).toBe(3)
    expect((await add(property.id, type.id, '101-103')).status).toBe(200)
    // Stopping one would oversell those nights.
    const off = await patchRoom(json('/api/rooms/x', 'PATCH', { isActive: false }), { params: Promise.resolve({ id: await roomId(property.id, '103') }) })
    expect(off.status).toBe(409)
  })

  it('a room with a current stay cannot be stopped or deleted; past stays keep its number', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id, { totalRooms: 5 })
    await add(property.id, type.id, '201-203')
    const now = await stay(property.id, type.id, '2026-12-10', '2026-12-12')
    expect((await assign(now.id, await roomId(property.id, '201'))).status).toBe(200)

    const room = await roomId(property.id, '201')
    expect((await deleteRoom(json('/api/rooms/x', 'DELETE'), { params: Promise.resolve({ id: room }) })).status).toBe(409)
    expect((await patchRoom(json('/api/rooms/x', 'PATCH', { isActive: false }), { params: Promise.resolve({ id: room }) })).status).toBe(409)

    // Renaming carries to the stay's printed number.
    expect((await patchRoom(json('/api/rooms/x', 'PATCH', { number: '201a' }), { params: Promise.resolve({ id: room }) })).status).toBe(200)
    expect(await roomOf(now.id)).toBe('201A')

    await prisma.booking.update({ where: { id: now.id }, data: { status: 'CHECKED_OUT' } })
    expect((await deleteRoom(json('/api/rooms/x', 'DELETE'), { params: Promise.resolve({ id: room }) })).status).toBe(200)
    expect(await roomOf(now.id)).toBe('201A')
    expect(await total(type.id)).toBe(2)
  })
})

describe('assigning and moving stays', () => {
  async function hotelWithRooms() {
    const { owner, property, workspace } = await createTenant()
    signInAs(owner)
    const standard = await createRoomType(property.id, { name: 'Standard', totalRooms: 9 })
    const deluxe = await createRoomType(property.id, { name: 'Deluxe', totalRooms: 9 })
    await add(property.id, standard.id, '101-102')
    await add(property.id, deluxe.id, '301')
    return { owner, property, workspace, standard, deluxe }
  }

  it('puts a stay in a free room and refuses one another stay holds', async () => {
    const { property, standard } = await hotelWithRooms()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-13')
    const b = await stay(property.id, standard.id, '2026-12-12', '2026-12-14')
    const r101 = await roomId(property.id, '101')

    expect((await assign(a.id, r101)).status).toBe(200)
    const item = await prisma.bookingItem.findFirstOrThrow({ where: { bookingId: a.id } })
    expect([item.roomId, item.roomNumber]).toEqual([r101, '101'])
    const refused = await assign(b.id, r101)
    expect(refused.status).toBe(409)
    expect(refused.body.error).toContain(a.bookingCode)
    expect((await assign(b.id, await roomId(property.id, '102'))).status).toBe(200)

    // Out of the room again.
    expect((await assign(a.id, null)).status).toBe(200)
    expect(await roomOf(a.id)).toBeNull()
    expect(await prisma.activityLog.count({ where: { action: 'ROOM_ASSIGNED' } })).toBe(3)
  })

  it('refuses a room under maintenance, a stopped room, and another hotel’s room', async () => {
    const { owner, property, standard } = await hotelWithRooms()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-12')
    const r101 = await roomId(property.id, '101')
    await prisma.roomLock.create({
      data: { propertyId: property.id, roomTypeId: standard.id, roomId: r101, type: 'MAINTENANCE', lockStart: new Date('2026-12-11T00:00:00+07:00'), lockEnd: new Date('2026-12-15T00:00:00+07:00') },
    })
    expect((await assign(a.id, r101)).body.error).toContain('đang bảo trì')
    await prisma.room.update({ where: { id: await roomId(property.id, '102') }, data: { isActive: false } })
    expect((await assign(a.id, await roomId(property.id, '102'))).status).toBe(409)

    const other = await createTenant()
    const theirType = await createRoomType(other.property.id)
    const theirs = await prisma.room.create({ data: { propertyId: other.property.id, roomTypeId: theirType.id, number: '101' } })
    signInAs(owner)
    expect((await assign(a.id, theirs.id)).status).toBe(404)
  })

  it('moves a stay to another type only when that type has a room free every night', async () => {
    const { property, standard, deluxe } = await hotelWithRooms()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-12')
    const blocker = await stay(property.id, deluxe.id, '2026-12-11', '2026-12-13')
    const r301 = await roomId(property.id, '301')

    // Deluxe has one room, sold on the 11th.
    const full = await assign(a.id, r301)
    expect(full.status).toBe(409)
    expect(full.body.error).toBe('Hạng Deluxe đã kín trong những ngày này')

    await prisma.booking.update({ where: { id: blocker.id }, data: { status: 'CANCELLED' } })
    const moved = await assign(a.id, r301)
    expect(moved.body.data).toMatchObject({ to: '301', roomTypeChanged: true })
    expect((await prisma.bookingItem.findFirstOrThrow({ where: { bookingId: a.id } })).roomTypeId).toBe(deluxe.id)
  })

  it('two people putting stays in the same room at once: one wins', async () => {
    const { property, standard } = await hotelWithRooms()
    const r102 = await roomId(property.id, '102')
    for (let round = 0; round < 3; round++) {
      await prisma.bookingItem.updateMany({ where: { roomId: r102 }, data: { roomId: null, roomNumber: null } })
      const x = await stay(property.id, standard.id, '2026-12-20', '2026-12-22')
      const y = await stay(property.id, standard.id, '2026-12-21', '2026-12-23')
      const statuses = (await Promise.all([assign(x.id, r102), assign(y.id, r102)])).map((r) => r.status).sort()
      expect(statuses).toEqual([200, 409])
    }
  })

  it('a typed number of a listed room assigns that room; an unknown one is refused for a listed type', async () => {
    const { property, standard } = await hotelWithRooms()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-12')
    expect((await setRoom(a.id, '101')).status).toBe(200)
    expect((await prisma.bookingItem.findFirstOrThrow({ where: { bookingId: a.id } })).roomId).toBe(await roomId(property.id, '101'))
    expect((await setRoom(a.id, '999')).status).toBe(400)
  })

  it('staff create a booking straight into a listed room of its type', async () => {
    const { owner, property, standard, deluxe } = await hotelWithRooms()
    const make = (room: string) =>
      createBooking({
        propertyId: property.id,
        roomTypeId: standard.id,
        guestName: 'Khách Quầy',
        guestEmail: '',
        guestPhone: '0900000031',
        checkIn: new Date('2026-12-11T00:00:00+07:00'),
        checkOut: new Date('2026-12-12T00:00:00+07:00'),
        numAdults: 1,
        numChildren: 0,
        roomId: room,
        createdById: owner.id,
      })
    const { booking } = await make(await roomId(property.id, '102'))
    expect(await roomOf(booking.id)).toBe('102')
    await expect(make(await roomId(property.id, '102'))).rejects.toThrow('Phòng 102 đã có đơn')
    void deluxe
    await expect(make(await roomId(property.id, '301'))).rejects.toThrow('Phòng đã chọn không thuộc hạng phòng này')
  })
})

describe('maintenance of one room', () => {
  const close = async (body: object) => {
    const res = await maintenanceRoute(json('/api/rooms/maintenance', 'POST', body))
    return { status: res.status, body: await res.json() }
  }

  it('closes one room; refuses a room with a stay, or a type with nothing left to close', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id, { totalRooms: 9 })
    await add(property.id, type.id, '401-402')
    const span = { startDate: '2026-12-10T00:00:00+07:00', endDate: '2026-12-12T00:00:00+07:00' }
    const r401 = await roomId(property.id, '401')
    const r402 = await roomId(property.id, '402')

    const guest = await stay(property.id, type.id, '2026-12-11', '2026-12-13')
    expect((await assign(guest.id, r401)).status).toBe(200)
    expect((await close({ propertyId: property.id, roomTypeId: type.id, roomId: r401, ...span })).status).toBe(409)
    expect((await close({ propertyId: property.id, roomTypeId: type.id, roomId: r402, ...span })).status).toBe(200)
    // Both rooms now taken on the 11th: nothing left to close.
    await assign(guest.id, null)
    const full = await close({ propertyId: property.id, roomTypeId: type.id, roomId: r401, ...span })
    expect(full.status).toBe(409)
    expect(full.body.error).toContain('đã kín')
  })
})

describe('the timeline', () => {
  it("shows the hotel's rooms, stays with their room, and maintenance; front desk only", async () => {
    const { owner, property, workspace } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id, { totalRooms: 9 })
    await add(property.id, type.id, '501-502')
    const a = await stay(property.id, type.id, '2026-12-10', '2026-12-12')
    await assign(a.id, await roomId(property.id, '502'))
    await stay(property.id, type.id, '2027-01-10', '2027-01-12') // outside the window

    const get = () => timelineRoute(new NextRequest(`http://digistay.test/api/properties/${property.id}/timeline?from=2026-12-08&days=14`), { params: Promise.resolve({ id: property.id }) })
    const body = await (await get()).json()
    expect(body.data.roomTypes[0].rooms.map((r: { number: string }) => r.number)).toEqual(['501', '502'])
    expect(body.data.stays).toHaveLength(1)
    expect(body.data.stays[0]).toMatchObject({ bookingCode: a.bookingCode, roomNumber: '502' })

    const member = await createUser()
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: member.id, role: 'USER' } })
    signInAs(member)
    expect((await get()).status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// Mid-stay room changes: from the night of a date, the stay moves to another
// room (rooms.ts, room-plan.ts). Every rule of a move holds for those nights.

import { addDays, vnDay } from './room-plan'
import { roomsTaken } from './occupancy'
import { POST as extendRoute } from '@/app/api/bookings/[id]/extend/route'

describe('changing rooms part way through a stay', () => {
  async function hotel() {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const standard = await createRoomType(property.id, { name: 'Standard', totalRooms: 9 })
    const deluxe = await createRoomType(property.id, { name: 'Deluxe', totalRooms: 9 })
    await add(property.id, standard.id, '101-103')
    await add(property.id, deluxe.id, '301')
    const room = (number: string) => roomId(property.id, number)
    return { owner, property, standard, deluxe, room }
  }
  const moveFrom = async (bookingId: string, roomId: string | null, fromDate?: string, toDate?: string) => {
    const res = await assignRoute(json(`/api/bookings/${bookingId}/room`, 'POST', { roomId, fromDate, toDate }), { params: Promise.resolve({ id: bookingId }) })
    return { status: res.status, body: await res.json() }
  }
  /** The stay's rooms in night order: "101 10/12–12/12" (Vietnam days). */
  const planOf = async (bookingId: string) => {
    const parts = await prisma.bookingRoomSegment.findMany({ where: { bookingId }, orderBy: { fromDate: 'asc' } })
    if (parts.length === 0) return [`${await roomOf(bookingId)} whole`]
    return parts.map((p) => `${p.roomNumber} ${vnDay(p.fromDate).slice(5)}–${vnDay(p.toDate).slice(5)}`)
  }
  const at = (day: string) => new Date(`${day}T00:00:00+07:00`)

  it('moves the nights from a date to another room; the first nights stay, the item keeps the first room', async () => {
    const { property, standard, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-14')
    expect((await assign(a.id, await room('101'))).status).toBe(200)

    const moved = await moveFrom(a.id, await room('102'), '2026-12-12')
    expect(moved.status).toBe(200)
    expect(moved.body.data).toMatchObject({ from: '101', to: '102', roomTypeChanged: false, split: true })
    expect(await planOf(a.id)).toEqual(['101 12-10–12-12', '102 12-12–12-14'])
    // Boundaries keep the stay's own instants.
    const parts = await prisma.bookingRoomSegment.findMany({ where: { bookingId: a.id }, orderBy: { fromDate: 'asc' } })
    expect([parts[0].fromDate, parts[1].fromDate, parts[1].toDate]).toEqual([at('2026-12-10'), at('2026-12-12'), at('2026-12-14')])
    expect(await roomOf(a.id)).toBe('101')
    const log = await prisma.activityLog.findFirstOrThrow({ where: { action: 'ROOM_ASSIGNED', entityId: a.id }, orderBy: { createdAt: 'desc' } })
    expect(log.changes).toMatchObject({ from: '101', to: '102', fromDate: '2026-12-12' })

    // 101 is free from the 12th, 102 until then.
    const later = await stay(property.id, standard.id, '2026-12-12', '2026-12-14')
    const earlier = await stay(property.id, standard.id, '2026-12-10', '2026-12-12')
    expect((await assign(later.id, await room('102'))).status).toBe(409)
    expect((await assign(later.id, await room('101'))).status).toBe(200)
    expect((await assign(earlier.id, await room('101'))).status).toBe(409)
    expect((await assign(earlier.id, await room('102'))).status).toBe(200)

    // Moving the last part back where the stay started makes it one room again.
    await assign(later.id, await room('103'))
    expect((await moveFrom(a.id, await room('101'), '2026-12-12')).body.data.split).toBe(false)
    expect(await planOf(a.id)).toEqual(['101 whole'])
  })

  it('refuses a room another stay holds on a later night of the part moved', async () => {
    const { property, standard, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-14')
    const b = await stay(property.id, standard.id, '2026-12-13', '2026-12-15')
    await assign(a.id, await room('101'))
    await assign(b.id, await room('102'))

    const refused = await moveFrom(a.id, await room('102'), '2026-12-11')
    expect(refused.status).toBe(409)
    expect(refused.body.error).toBe(`Phòng 102 đã có đơn ${b.bookingCode} (13/12/2026 – 15/12/2026)`)
    expect(await planOf(a.id)).toEqual(['101 whole'])
    // The nights before b arrives are free: a part of the stay can go there.
    expect((await moveFrom(a.id, await room('102'), '2026-12-11', '2026-12-13')).status).toBe(200)
    expect(await planOf(a.id)).toEqual(['101 12-10–12-11', '102 12-11–12-13', '101 12-13–12-14'])

    // Another stay meets the moved part, with its own dates in the message.
    const c = await stay(property.id, standard.id, '2026-12-12', '2026-12-13')
    const clash = await assign(c.id, await room('102'))
    expect(clash.body.error).toBe(`Phòng 102 đã có đơn ${a.bookingCode} (11/12/2026 – 13/12/2026)`)
  })

  it('refuses a room under maintenance on one of the nights moved', async () => {
    const { property, standard, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-14')
    await assign(a.id, await room('101'))
    await prisma.roomLock.create({
      data: { propertyId: property.id, roomTypeId: standard.id, roomId: await room('102'), type: 'MAINTENANCE', lockStart: at('2026-12-13'), lockEnd: at('2026-12-16') },
    })
    const refused = await moveFrom(a.id, await room('102'), '2026-12-12')
    expect(refused.status).toBe(409)
    expect(refused.body.error).toBe('Phòng 102 đang bảo trì (13/12/2026 – 16/12/2026)')
    expect((await moveFrom(a.id, await room('102'), '2026-12-11', '2026-12-13')).status).toBe(200)

    // A part in a room cannot be closed for maintenance; the nights it left can.
    const close = (start: string, end: string) =>
      maintenanceRoute(json('/api/rooms/maintenance', 'POST', { propertyId: property.id, roomTypeId: standard.id, roomId: room101, startDate: `${start}T00:00:00+07:00`, endDate: `${end}T00:00:00+07:00` }))
    const room101 = await room('101')
    expect((await close('2026-12-10', '2026-12-11')).status).toBe(409)
    expect((await close('2026-12-11', '2026-12-13')).status).toBe(200)
  })

  it('moves the inventory of the nights moved to another type, only if it has a room free on each', async () => {
    const { property, standard, deluxe, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-14')
    await assign(a.id, await room('101'))
    // Deluxe lists one room; a stay without a room takes it on the 13th.
    const blocker = await stay(property.id, deluxe.id, '2026-12-13', '2026-12-14')

    const full = await moveFrom(a.id, await room('301'), '2026-12-12')
    expect(full.status).toBe(409)
    expect(full.body.error).toBe('Hạng Deluxe đã kín trong những ngày này')
    // The 12th alone is free in Deluxe.
    expect((await moveFrom(a.id, await room('301'), '2026-12-12', '2026-12-13')).body.data).toMatchObject({ roomTypeChanged: true, split: true })

    const span = (from: string, to: string) => ({ propertyId: property.id, checkIn: at(from), checkOut: at(to) })
    expect(await roomsTaken(prisma, deluxe.id, span('2026-12-12', '2026-12-13'))).toBe(1)
    expect(await roomsTaken(prisma, deluxe.id, span('2026-12-10', '2026-12-12'))).toBe(0)
    expect(await roomsTaken(prisma, standard.id, span('2026-12-12', '2026-12-13'))).toBe(0)
    expect(await roomsTaken(prisma, standard.id, span('2026-12-10', '2026-12-14'))).toBe(1)
    // The price stays as booked; the item keeps the first night's type.
    const item = await prisma.bookingItem.findFirstOrThrow({ where: { bookingId: a.id } })
    expect(item.roomTypeId).toBe(standard.id)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: a.id } })).totalAmount).toBe(a.totalAmount)

    // Deluxe now has nothing left on the 12th for another stay.
    const other = await stay(property.id, deluxe.id, '2026-12-12', '2026-12-13')
    expect((await assign(other.id, await room('301'))).status).toBe(409)

    await prisma.booking.update({ where: { id: blocker.id }, data: { status: 'CANCELLED' } })
    expect((await moveFrom(a.id, await room('301'), '2026-12-12')).status).toBe(200)
    expect(await planOf(a.id)).toEqual(['101 12-10–12-12', '301 12-12–12-14'])
    expect(await roomsTaken(prisma, deluxe.id, span('2026-12-13', '2026-12-14'))).toBe(1)
  })

  it('two people moving parts of stays into one room at once: one wins', async () => {
    const { property, standard, room } = await hotel()
    const r103 = await room('103')
    for (let round = 0; round < 4; round++) {
      const base = addDays('2027-01-05', round * 10)
      const x = await stay(property.id, standard.id, base, addDays(base, 4))
      const y = await stay(property.id, standard.id, base, addDays(base, 4))
      await assign(x.id, await room('101'))
      await assign(y.id, await room('102'))
      const results = await Promise.all([moveFrom(x.id, r103, addDays(base, 2)), moveFrom(y.id, r103, addDays(base, 1))])
      expect(results.map((r) => r.status).sort()).toEqual([200, 409])
      const holders = await prisma.bookingRoomSegment.count({ where: { roomId: r103, booking: { id: { in: [x.id, y.id] } } } })
      expect(holders).toBe(1)
    }
  })

  it('refuses dates not strictly inside the stay, nights already past, and taking a room out from a date', async () => {
    const { property, standard, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-14')
    await assign(a.id, await room('101'))
    const r102 = await room('102')
    for (const date of ['2026-12-10', '2026-12-14', '2026-12-09', '2026-12-20']) {
      const res = await moveFrom(a.id, r102, date)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Ngày đổi phòng phải sau ngày nhận và trước ngày trả phòng (10/12/2026 – 14/12/2026)')
    }
    expect((await moveFrom(a.id, r102, '2026-12-10', '2026-12-14')).status).toBe(400)
    expect((await moveFrom(a.id, r102, '2026-12-12', '2026-12-12')).status).toBe(400)
    expect((await moveFrom(a.id, r102, '2026-02-30')).body.error).toBe('Ngày đổi phòng không hợp lệ')
    expect((await moveFrom(a.id, r102, '12/12/2026')).status).toBe(400)
    expect((await moveFrom(a.id, null, '2026-12-12')).body.error).toBe('Chỉ bỏ xếp phòng được cho cả kỳ lưu trú')

    // A stay without a room has nothing to change from.
    const bare = await stay(property.id, standard.id, '2026-12-20', '2026-12-23')
    expect((await moveFrom(bare.id, r102, '2026-12-21')).body.error).toBe('Xếp phòng cho đơn trước khi đổi phòng từ một ngày')

    // A guest in house since two days ago: last night is past, tonight moves.
    const today = vnDay(new Date())
    const inHouse = await stay(property.id, standard.id, addDays(today, -2), addDays(today, 2), 'CHECKED_IN')
    await assign(inHouse.id, await room('103'))
    const past = await moveFrom(inHouse.id, r102, addDays(today, -1))
    expect(past.status).toBe(409)
    expect(past.body.error).toBe('Không đổi phòng được cho những đêm đã qua')
    expect((await moveFrom(inHouse.id, r102, today)).status).toBe(200)
    expect(await planOf(inHouse.id)).toEqual([`103 ${addDays(today, -2).slice(5)}–${today.slice(5)}`, `102 ${today.slice(5)}–${addDays(today, 2).slice(5)}`])
    expect(await prisma.bookingRoomSegment.count({ where: { bookingId: a.id } })).toBe(0)
  })

  it('a whole-stay move after a split puts every night in one room again', async () => {
    const { property, standard, deluxe, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-14')
    await assign(a.id, await room('101'))
    await moveFrom(a.id, await room('301'), '2026-12-12')
    expect(await planOf(a.id)).toEqual(['101 12-10–12-12', '301 12-12–12-14'])

    // Its own nights in Deluxe do not count against it.
    const whole = await assign(a.id, await room('301'))
    expect(whole.status).toBe(200)
    expect(whole.body.data).toMatchObject({ from: '101 → 301', to: '301', roomTypeChanged: true, split: false })
    expect(await planOf(a.id)).toEqual(['301 whole'])
    expect((await prisma.bookingItem.findFirstOrThrow({ where: { bookingId: a.id } })).roomTypeId).toBe(deluxe.id)

    await moveFrom(a.id, await room('102'), '2026-12-13')
    expect((await assign(a.id, null)).status).toBe(200)
    expect(await planOf(a.id)).toEqual(['null whole'])
    // A typed number (the booking panel) is the whole stay's too.
    await assign(a.id, await room('101'))
    await moveFrom(a.id, await room('102'), '2026-12-13')
    expect((await setRoom(a.id, '103')).status).toBe(200)
    expect(await planOf(a.id)).toEqual(['103 whole'])
  })

  it('an extension keeps the guest in their last room: it grows, and must be free', async () => {
    const { property, standard, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-13')
    await assign(a.id, await room('101'))
    await moveFrom(a.id, await room('102'), '2026-12-12')
    const next = await stay(property.id, standard.id, '2026-12-14', '2026-12-16')
    await assign(next.id, await room('102'))

    const extend = (until: string) =>
      extendRoute(json(`/api/bookings/${a.id}/extend`, 'POST', { newCheckOutDate: `${until}T00:00:00+07:00` }), { params: Promise.resolve({ id: a.id }) })
    const refused = await extend('2026-12-15')
    expect(refused.status).toBe(409)
    expect((await refused.json()).error).toBe(`Phòng 102 đã có đơn ${next.bookingCode} (14/12/2026 – 16/12/2026)`)
    expect((await extend('2026-12-14')).status).toBe(200)
    expect(await planOf(a.id)).toEqual(['101 12-10–12-12', '102 12-12–12-14'])
  })

  it('the timeline draws each part in its room; rooms follow renames and stay held', async () => {
    const { property, standard, room } = await hotel()
    const a = await stay(property.id, standard.id, '2026-12-10', '2026-12-14')
    await assign(a.id, await room('101'))
    await moveFrom(a.id, await room('102'), '2026-12-12')

    const res = await timelineRoute(new NextRequest(`http://digistay.test/api/properties/${property.id}/timeline?from=2026-12-08&days=14`), { params: Promise.resolve({ id: property.id }) })
    const stays = (await res.json()).data.stays as { roomNumber: string; from: string; to: string; split: boolean; checkIn: string }[]
    expect(stays.map((s) => [s.roomNumber, vnDay(s.from), vnDay(s.to), s.split])).toEqual([
      ['101', '2026-12-10', '2026-12-12', true],
      ['102', '2026-12-12', '2026-12-14', true],
    ])
    expect(new Set(stays.map((s) => s.checkIn)).size).toBe(1)

    // 102 holds the future part: it cannot stop; a rename carries to the part.
    const r102 = await room('102')
    expect((await patchRoom(json('/api/rooms/x', 'PATCH', { isActive: false }), { params: Promise.resolve({ id: r102 }) })).status).toBe(409)
    expect((await patchRoom(json('/api/rooms/x', 'PATCH', { number: '102b' }), { params: Promise.resolve({ id: r102 }) })).status).toBe(200)
    expect(await planOf(a.id)).toEqual(['101 12-10–12-12', '102B 12-12–12-14'])

    // The booking panel lists the rooms free for those nights.
    const { GET: available } = await import('@/app/api/rooms/available/route')
    const query = new URLSearchParams({ propertyId: property.id, roomTypeId: standard.id, checkIn: '2026-12-12T00:00:00+07:00', checkOut: '2026-12-14T00:00:00+07:00', all: '1' })
    const rooms = (await (await available(new NextRequest(`http://digistay.test/api/rooms/available?${query}`))).json()).data as { number: string; status: string }[]
    expect(rooms.map((r) => `${r.number}:${r.status}`)).toEqual(['101:AVAILABLE', '102B:OCCUPIED', '103:AVAILABLE'])
  })
})
