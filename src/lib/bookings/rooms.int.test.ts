/**
 * A room number is one room (src/lib/bookings/rooms.ts): giving a stay a
 * room that another active stay holds on one of its nights is refused, in
 * the booking panel (PATCH /api/bookings/[id]) and when staff create a
 * booking with a room. Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking as createFixtureBooking, createRoomType, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { createBooking } from './create-booking'
import { PATCH } from '@/app/api/bookings/[id]/route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

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
    expect(refused.body.error).toBe(`Phòng a101 đã có đơn ${a.bookingCode} (10/12/2026 – 13/12/2026)`)
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
