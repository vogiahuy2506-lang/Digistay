/**
 * GET /api/bookings against real Postgres: tenant scoping with the real
 * relation filters, including the workspaceId the dashboard sends.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GET } from './route'
import { createBooking, createTenant, resetDatabase } from '@/test/integration/fixtures'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>

function signInAs(user: { id: string; email: string }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
}

function get(query = '') {
  return GET(new NextRequest(`http://localhost/api/bookings${query}`))
}

async function getIds(query = '') {
  const body = await (await get(query)).json()
  return (body.data as { id: string }[]).map((b) => b.id).sort()
}

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('GET /api/bookings (Postgres)', () => {
  it('only returns bookings of the caller\'s own hotels, with a matching total', async () => {
    const hotelA = await createTenant({ memberRole: 'RECEPTIONIST' })
    const hotelB = await createTenant({ memberRole: 'RECEPTIONIST' })
    const bookingA = await createBooking(hotelA.property.id)
    await createBooking(hotelB.property.id)
    signInAs(hotelA.member!)

    const body = await (await get()).json()

    expect(body.data.map((b: { id: string }) => b.id)).toEqual([bookingA.id])
    expect(body.pagination.total).toBe(1)
  })

  it('workspaceId of another tenant returns nothing; propertyId of another tenant is 403', async () => {
    const hotelA = await createTenant({ memberRole: 'RECEPTIONIST' })
    const hotelB = await createTenant({ memberRole: 'RECEPTIONIST' })
    const bookingA = await createBooking(hotelA.property.id)
    await createBooking(hotelB.property.id)
    signInAs(hotelA.member!)

    expect(await getIds(`?workspaceId=${hotelA.workspace.id}`)).toEqual([bookingA.id])
    expect(await getIds(`?workspaceId=${hotelB.workspace.id}`)).toEqual([])
    expect((await get(`?propertyId=${hotelB.property.id}`)).status).toBe(403)
  })

  it('searches every page by code, name (any case) and phone, never across tenants', async () => {
    const hotelA = await createTenant({ memberRole: 'RECEPTIONIST' })
    const hotelB = await createTenant({ memberRole: 'RECEPTIONIST' })
    const target = await prisma.booking.update({
      where: { id: (await createBooking(hotelA.property.id)).id },
      data: { guestName: 'Châu Ngọc Hân', guestPhone: '0912345406' },
    })
    // 25 newer bookings push the target off the first page of 20.
    for (let i = 0; i < 25; i++) await createBooking(hotelA.property.id)
    const other = await createBooking(hotelB.property.id)
    await prisma.booking.update({ where: { id: other.id }, data: { guestName: 'Châu Ngọc Hân' } })
    signInAs(hotelA.member!)
    const scope = `propertyId=${hotelA.property.id}`

    expect(await getIds(`?${scope}&q=${encodeURIComponent('châu ngọc')}`)).toEqual([target.id])
    expect(await getIds(`?${scope}&q=345406`)).toEqual([target.id])
    expect(await getIds(`?${scope}&q=${target.bookingCode.slice(2, 10).toLowerCase()}`)).toEqual([target.id])
    expect(await getIds(`?q=${encodeURIComponent('Châu Ngọc')}`)).toEqual([target.id])
  })

  it('counts each status tab within the caller\'s hotel and the other filters', async () => {
    const hotelA = await createTenant({ memberRole: 'RECEPTIONIST' })
    const hotelB = await createTenant({ memberRole: 'RECEPTIONIST' })
    await createBooking(hotelA.property.id, { status: 'PENDING' })
    await createBooking(hotelA.property.id, { status: 'PENDING' })
    const checkedIn = await createBooking(hotelA.property.id, { status: 'CHECKED_IN' })
    await prisma.booking.update({ where: { id: checkedIn.id }, data: { source: 'OTA', paymentStatus: 'PAID' } })
    await createBooking(hotelB.property.id, { status: 'PENDING' })
    signInAs(hotelA.member!)

    const all = await (await get(`?propertyId=${hotelA.property.id}&status=PENDING&counts=1`)).json()
    expect(all.data).toHaveLength(2)
    expect(all.statusCounts).toMatchObject({ ALL: 3, PENDING: 2, CHECKED_IN: 1, CONFIRMED: 0 })

    const ota = await (await get(`?propertyId=${hotelA.property.id}&source=OTA&counts=1`)).json()
    expect(ota.data.map((b: { id: string }) => b.id)).toEqual([checkedIn.id])
    expect(ota.statusCounts).toMatchObject({ ALL: 1, PENDING: 0, CHECKED_IN: 1 })

    const paid = await (await get(`?propertyId=${hotelA.property.id}&paymentStatus=PAID`)).json()
    expect(paid.data.map((b: { id: string }) => b.id)).toEqual([checkedIn.id])

    // No propertyId: still only hotel A's bookings in the counts.
    const scoped = await (await get('?counts=1')).json()
    expect(scoped.statusCounts.ALL).toBe(3)
  })

  it('names the room type of each booked room', async () => {
    const hotel = await createTenant({ memberRole: 'RECEPTIONIST' })
    const roomType = await prisma.roomType.create({
      data: { propertyId: hotel.property.id, name: 'Deluxe Hướng Biển', slug: 'deluxe', bedType: 'DOUBLE' },
    })
    const booking = await createBooking(hotel.property.id)
    await prisma.bookingItem.create({
      data: {
        bookingId: booking.id,
        roomTypeId: roomType.id,
        roomNumber: '203',
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        basePrice: 1_000_000,
        totalPrice: 1_000_000,
      },
    })
    signInAs(hotel.member!)

    const body = await (await get(`?propertyId=${hotel.property.id}`)).json()
    expect(body.data[0].bookingItems[0]).toMatchObject({ roomNumber: '203', roomTypeName: 'Deluxe Hướng Biển' })
  })
})
