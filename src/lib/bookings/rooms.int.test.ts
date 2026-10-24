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
async function stay(propertyId: string, roomTypeId: string, checkIn: string, checkOut: string, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') {
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
