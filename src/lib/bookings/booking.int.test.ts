/**
 * Booking prices and rooms, staff and guests, against real Postgres:
 * the room type's own price is what is quoted and charged; rooms are
 * counted per room type, once, with maintenance; a guest's hold is theirs;
 * the public route checks what a stranger can send.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session.current), authOptions: {} }))
// Some routes (room types) read the session through next-auth directly.
vi.mock('next-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-auth')>()),
  getServerSession: vi.fn(async () => session.current),
}))
// Rate limits use Redis: an in-memory one (CI has none).
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

import { prisma } from '@/lib/db'
import { createRoomType, createTenant, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { decryptSecret, secretContext } from '@/lib/security/secret-box'
import { quoteStay } from '@/lib/pricing/quote'
import { heldBySession, roomsTakenByType } from '@/lib/bookings/occupancy'
import { POST as staffBooking } from '@/app/api/bookings/route'
import { POST as guestBooking } from '@/app/api/public/bookings/route'
import { GET as availability } from '@/app/api/bookings/availability/route'
import { POST as holdRoom } from '@/app/api/bookings/room-lock/route'
import { POST as extend } from '@/app/api/bookings/[id]/extend/route'
import { PUT as editRoomType } from '@/app/api/room-types/[id]/route'

const signInAs = (user: { id: string; email: string }) => {
  session.current = { user: { id: user.id, email: user.email } }
}
const json = (body: object, headers: Record<string, string> = {}) =>
  new NextRequest('http://digistay.test/api/x', { method: 'POST', body: JSON.stringify(body), headers })
const call = async (res: Response | Promise<Response>) => {
  const r = await res
  return { status: r.status, body: await r.json() }
}

// Mon 7 → Wed 9 Dec 2026: two weekday nights. Fri 4 → Sun 6: Fri (weekday) + Sat (weekend).
const WEEKDAYS = { checkInDate: '2026-12-07', checkOutDate: '2026-12-09' }
const guest = (n = 0) => ({ guestName: 'Lê Thị Hoa', guestEmail: `hoa${n}@example.com`, guestPhone: '0912345678' })
let ipCounter = 0
const freshIp = () => ({ 'x-real-ip': `203.0.113.${++ipCounter % 250}` })

beforeEach(async () => {
  await resetDatabase()
  redis.data.clear()
  session.current = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('prices', () => {
  it("a booking is charged its room type's own price, not the first room type's", async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await createRoomType(property.id, { name: 'Standard', weekdayPrice: 500_000 }) // created first
    const deluxe = await createRoomType(property.id, { name: 'Deluxe', weekdayPrice: 900_000 })
    const { status, body } = await call(staffBooking(json({ propertyId: property.id, roomTypeId: deluxe.id, ...guest(), ...WEEKDAYS, numAdults: 2 })))
    expect(status).toBe(200)
    expect(body.data).toMatchObject({ subtotal: 1_800_000, extraCharges: 0, totalAmount: 1_800_000 })
  })

  it('an edited price applies to the next booking; a room type without a price takes none until it has one', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const room = await createRoomType(property.id, { weekdayPrice: 500_000 })
    expect((await call(editRoomType(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ weekdayPrice: 950_000, weekendPrice: 950_000 }) }), { params: Promise.resolve({ id: room.id }) }))).status).toBe(200)
    const priced = await call(staffBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(), ...WEEKDAYS, numAdults: 2 })))
    expect(priced.body.data.totalAmount).toBe(1_900_000)

    const unpriced = await createRoomType(property.id, { weekdayPrice: null })
    const refused = await call(staffBooking(json({ propertyId: property.id, roomTypeId: unpriced.id, ...guest(), ...WEEKDAYS, numAdults: 2 })))
    expect(refused.status).toBe(400)
    expect(refused.body.error).toContain('chưa có giá')
    // Setting its price used to fail (500): there was no price row to update.
    const set = await call(editRoomType(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ weekdayPrice: 400_000 }) }), { params: Promise.resolve({ id: unpriced.id }) }))
    expect(set.status).toBe(200)
    expect((await call(staffBooking(json({ propertyId: property.id, roomTypeId: unpriced.id, ...guest(1), ...WEEKDAYS, numAdults: 2 })))).body.data.totalAmount).toBe(800_000)
  })

  it('what the site quotes is what the guest is charged: weekend, extra adult, services', async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const room = await createRoomType(property.id, { weekdayPrice: 900_000, weekendPrice: 1_100_000, baseOccupancy: 2, maxAdults: 3, propertyExtraAdult: 150_000 })
    const breakfast = await prisma.extraService.create({
      data: { propertyId: property.id, name: 'Ăn sáng', price: 100_000, priceType: 'PER_NIGHT', perPerson: true },
    })
    const dates = { checkInDate: '2026-12-04', checkOutDate: '2026-12-06' }
    const quoted = await call(availability(new NextRequest(`http://x/api/bookings/availability?propertyId=${property.id}&checkInDate=${dates.checkInDate}&checkOutDate=${dates.checkOutDate}&numGuests=3`)))
    const offer = quoted.body.data[0]
    expect(offer.pricing).toMatchObject({ basePrice: 2_000_000, total: 2_300_000, extraAdultPrice: 150_000 })
    // The page adds services with the same function (src/lib/pricing/quote.ts).
    const shown = quoteStay({
      rates: offer.pricing,
      checkIn: new Date(dates.checkInDate),
      checkOut: new Date(dates.checkOutDate),
      numAdults: 3,
      numChildren: 0,
      baseOccupancy: offer.baseOccupancy,
      services: [{ service: breakfast, quantity: 1 }],
    }).total
    expect(shown).toBe(2_300_000 + 100_000 * 2 * 3)

    const booked = await call(guestBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(), ...dates, numAdults: 3, services: [{ serviceId: breakfast.id, quantity: 1 }] }, freshIp())))
    expect(booked.status).toBe(200)
    expect(booked.body.data.totalAmount).toBe(shown)
    const row = await prisma.booking.findFirstOrThrow({ where: { bookingCode: booked.body.data.bookingCode } })
    expect(row).toMatchObject({ subtotal: 2_000_000, extraCharges: 300_000 + 600_000, totalAmount: shown })
    expect(row.services).toEqual([{ serviceId: breakfast.id, name: 'Ăn sáng', quantity: 1, amount: 600_000 }])
  })
})

describe('rooms', () => {
  it('a booking takes a room of its own type, once', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const standard = await createRoomType(property.id, { totalRooms: 1 })
    const deluxe = await createRoomType(property.id, { totalRooms: 2 })
    const book = (roomTypeId: string, n: number) => call(staffBooking(json({ propertyId: property.id, roomTypeId, ...guest(n), ...WEEKDAYS, numAdults: 2 })))
    expect((await book(standard.id, 1)).status).toBe(200)
    // Standard is full; Deluxe is not (it used to count Standard's booking).
    expect((await book(standard.id, 2)).status).toBe(409)
    expect((await book(deluxe.id, 3)).status).toBe(200)
    // Its second room too (each booking used to count twice, with its own lock).
    expect((await book(deluxe.id, 4)).status).toBe(200)
    expect((await book(deluxe.id, 5)).status).toBe(409)
    // A check-out day is free for the next check-in.
    expect((await call(staffBooking(json({ propertyId: property.id, roomTypeId: standard.id, ...guest(6), checkInDate: '2026-12-09', checkOutDate: '2026-12-10', numAdults: 2 })))).status).toBe(200)
  })

  it('the site asks with adults and children apart: rooms that take no children are left out, a child is priced as a child', async () => {
    const { property } = await createTenant()
    // The first room type sets the property's surcharges: 100,000 a child a night.
    await createRoomType(property.id, { name: 'Đơn', maxChildren: 0, weekdayPrice: 500_000, propertyExtraChild: 100_000 })
    await createRoomType(property.id, { name: 'Gia đình', maxChildren: 2, maxOccupancy: 4, weekdayPrice: 900_000 })
    const offer = async (query: string) =>
      (await call(availability(new NextRequest(`http://x/api/bookings/availability?propertyId=${property.id}&checkInDate=2026-12-07&checkOutDate=2026-12-09&${query}`)))).body

    const family = await offer('numGuests=3&numAdults=2&numChildren=1')
    expect(family.data.map((r: { name: string }) => r.name)).toEqual(['Gia đình'])
    expect(family.data[0].pricing.total).toBe(2 * 900_000 + 2 * 100_000)
    expect(family.meta).toMatchObject({ numAdults: 2, numChildren: 1 })

    // Without the split (the staff page), as before: everyone an adult, only the total checked.
    expect((await offer('numGuests=3')).data).toHaveLength(2)
  })

  it('maintenance blocks booking, with no end date, and shows as taken', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const room = await createRoomType(property.id, { totalRooms: 1 })
    await prisma.roomLock.create({
      data: { propertyId: property.id, roomTypeId: room.id, lockStart: new Date('2026-12-01'), lockEnd: new Date('2026-12-31'), type: 'MAINTENANCE', expiresAt: null },
    })
    expect((await call(staffBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(), ...WEEKDAYS, numAdults: 2 })))).status).toBe(409)
    const offer = await call(availability(new NextRequest(`http://x/api/bookings/availability?propertyId=${property.id}&checkInDate=2026-12-07&checkOutDate=2026-12-09&numGuests=2`)))
    expect(offer.body.data[0]).toMatchObject({ availableRooms: 0, isAvailable: false })
  })

  it("a guest's hold keeps the room from others and is used by their own booking", async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const room = await createRoomType(property.id, { totalRooms: 1 })
    const hold = await call(holdRoom(json({ propertyId: property.id, roomTypeId: room.id, ...WEEKDAYS }, { ...freshIp(), 'x-session-id': 'guest-a' })))
    expect(hold.status).toBe(200)
    const body = (n: number, extra = {}) => ({ propertyId: property.id, roomTypeId: room.id, ...guest(n), ...WEEKDAYS, numAdults: 2, ...extra })

    expect((await call(guestBooking(json(body(1), freshIp())))).status).toBe(409) // someone else
    const mine = await call(guestBooking(json(body(2, { holdId: hold.body.data.lockId }), freshIp())))
    expect(mine.status).toBe(200) // their own hold used to block them
    expect(await prisma.roomLock.count({ where: { id: hold.body.data.lockId } })).toBe(0)
    expect((await call(guestBooking(json(body(3), freshIp())))).status).toBe(409) // booked now
  })

  it('a guest reloading the booking page keeps one hold and is not blocked by it; another browser is', async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const room = await createRoomType(property.id, { totalRooms: 1 })
    const [mine, theirs] = [randomBytes(16).toString('hex'), randomBytes(16).toString('hex')]
    const stay = { propertyId: property.id, roomTypeId: room.id, ...WEEKDAYS }
    const holdAs = (session: string) => call(holdRoom(json(stay, { ...freshIp(), 'x-session-id': session })))
    const holds = () => prisma.roomLock.count({ where: { roomTypeId: room.id, type: 'HOLD' } })
    // What the booking page (dat-phong/page.tsx) counts for a visitor: their own hold left out.
    const roomsLeft = async (session: string) => {
      const ownHoldId = await heldBySession(prisma, { propertyId: property.id, sessionId: session })
      const span = { propertyId: property.id, checkIn: new Date(WEEKDAYS.checkInDate), checkOut: new Date(WEEKDAYS.checkOutDate), ownHoldId }
      return room.totalRooms - ((await roomsTakenByType(prisma, span)).get(room.id) ?? 0)
    }

    const first = await holdAs(mine)
    expect(first.status).toBe(200)
    // Three reloads: each used to add a 15-minute hold and show "no longer available".
    for (let i = 0; i < 3; i++) {
      expect(await roomsLeft(mine)).toBe(1)
      expect((await holdAs(mine)).status).toBe(200)
    }
    expect(await holds()).toBe(1)
    // The page's own request carries the session as a cookie, not the header.
    const byCookie = await holdRoom(
      new NextRequest('http://digistay.test/api/x', { method: 'POST', body: JSON.stringify(stay), headers: { ...freshIp(), cookie: `ds-hold=${mine}` } })
    )
    expect(byCookie.status).toBe(200)
    expect(byCookie.cookies.get('ds-hold')).toBeUndefined() // already set
    expect(await holds()).toBe(1)

    // Another browser: still kept out of the last room.
    expect(await roomsLeft(theirs)).toBe(0)
    expect((await holdAs(theirs)).status).toBe(409)
    expect(await holds()).toBe(1)

    // A first visit gets its session as a cookie (the page reads it on reload).
    const other = await createRoomType(property.id, { name: 'Suite', totalRooms: 1 })
    const fresh = await holdRoom(json({ ...stay, roomTypeId: other.id }, freshIp()))
    expect(fresh.cookies.get('ds-hold')?.value).toMatch(/^[\w-]+$/)

    // The guest's booking uses the session's hold even when the page lost its id.
    const booked = await call(guestBooking(json({ ...stay, ...guest(1), numAdults: 2 }, { ...freshIp(), 'x-session-id': mine })))
    expect(booked.status).toBe(200)
    expect(await holds()).toBe(0)
  })

  it("a hold id from the browser frees only that guest's hold: not maintenance, not another room type's", async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const room = await createRoomType(property.id, { totalRooms: 1 })
    const other = await createRoomType(property.id, { name: 'Suite', totalRooms: 1 })
    const maintenance = await prisma.roomLock.create({
      data: { propertyId: property.id, roomTypeId: room.id, lockStart: new Date('2026-12-01'), lockEnd: new Date('2026-12-31'), type: 'MAINTENANCE', expiresAt: null },
    })
    const body = (roomTypeId: string, n: number, holdId: string) =>
      json({ propertyId: property.id, roomTypeId, ...guest(n), ...WEEKDAYS, numAdults: 2, holdId }, freshIp())

    // A maintenance lock's id used to take it out of the count.
    expect((await call(guestBooking(body(room.id, 1, maintenance.id)))).status).toBe(409)
    expect(await prisma.roomLock.count({ where: { id: maintenance.id } })).toBe(1)

    // Another room type's hold: the booking goes through, that hold stays.
    const hold = await call(holdRoom(json({ propertyId: property.id, roomTypeId: room.id, checkInDate: '2027-01-04', checkOutDate: '2027-01-06' }, { ...freshIp(), 'x-session-id': 'guest-b' })))
    expect(hold.status).toBe(200)
    expect((await call(guestBooking(body(other.id, 2, hold.body.data.lockId)))).status).toBe(200)
    expect(await prisma.roomLock.count({ where: { id: hold.body.data.lockId } })).toBe(1)
  })

  it('three guests at once for the last room: one booking', async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    for (let round = 0; round < 3; round++) {
      const room = await createRoomType(property.id, { totalRooms: 1 })
      const results = await Promise.all(
        [1, 2, 3].map((n) =>
          call(guestBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(10 * round + n), ...WEEKDAYS, numAdults: 2 }, freshIp())))
        )
      )
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
    }
  })

  it('an extension is priced like a booking and must find the extra nights free', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const room = await createRoomType(property.id, { totalRooms: 1, weekdayPrice: 500_000, baseOccupancy: 2, maxAdults: 3, propertyExtraAdult: 100_000 })
    const first = await call(staffBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(), ...WEEKDAYS, numAdults: 3 })))
    expect(first.body.data).toMatchObject({ subtotal: 1_000_000, extraCharges: 200_000, totalAmount: 1_200_000 })
    await prisma.booking.update({ where: { id: first.body.data.id }, data: { status: 'CHECKED_IN' } })

    const ext = (until: string) =>
      call(extend(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ newCheckOutDate: until }) }), { params: Promise.resolve({ id: first.body.data.id }) }))
    const ok = await ext('2026-12-10') // one more weekday night, three adults
    expect(ok.status).toBe(200)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: first.body.data.id } })).toMatchObject({
      subtotal: 1_500_000,
      extraCharges: 300_000,
      totalAmount: 1_800_000,
    })

    // Someone else has the room from the 10th: no further extension.
    await call(staffBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(1), checkInDate: '2026-12-10', checkOutDate: '2026-12-12', numAdults: 2 })))
    const blocked = await ext('2026-12-11')
    expect(blocked.status).toBe(409)
  })
})

describe('the public booking route', () => {
  it('is PENDING, records no payment, queues the emails, and tells the guest only what they need', async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const room = await createRoomType(property.id)
    const res = await call(guestBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(), ...WEEKDAYS, numAdults: 2 }, freshIp())))
    expect(res.status).toBe(200)
    // deposit: the PayOS link when the hotel takes one (guest-deposit.int.test.ts); none here.
    expect(Object.keys(res.body.data).sort()).toEqual(['bookingCode', 'checkInDate', 'checkOutDate', 'deposit', 'depositUnavailable', 'status', 'token', 'totalAmount'])
    expect(res.body.data).toMatchObject({ deposit: null, depositUnavailable: false })
    const booking = await prisma.booking.findFirstOrThrow({ where: { bookingCode: res.body.data.bookingCode }, include: { payments: true } })
    expect(booking).toMatchObject({ status: 'PENDING', source: 'DIRECT', createdById: null, depositAmount: 0 })
    expect(booking.payments).toEqual([])
    expect(await prisma.emailOutbox.count({ where: { refId: booking.id } })).toBe(2)
  })

  it('refuses what a stranger should not send', async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const other = await createTenant()
    await publishSite(other.property.id)
    const room = await createRoomType(property.id, { maxAdults: 2, maxOccupancy: 3 })
    const foreignService = await prisma.extraService.create({ data: { propertyId: other.property.id, name: 'Spa', price: 1 } })
    const base = { propertyId: property.id, roomTypeId: room.id, ...guest(), ...WEEKDAYS, numAdults: 2 }
    const send = async (body: object) => (await call(guestBooking(json(body, freshIp())))).status
    expect(await send({ ...base, checkInDate: '2020-01-01', checkOutDate: '2020-01-02' })).toBe(400) // past
    expect(await send({ ...base, checkOutDate: '2027-02-01' })).toBe(400) // too long
    expect(await send({ ...base, numAdults: 3 })).toBe(400) // too many adults
    expect(await send({ ...base, guestEmail: '' })).toBe(400)
    expect(await send({ ...base, services: [{ serviceId: foreignService.id, quantity: 1 }] })).toBe(400)
    expect(await send({ ...base, roomTypeId: (await createRoomType(other.property.id)).id })).toBe(404)
    await prisma.property.update({ where: { id: property.id }, data: { isActive: false } })
    expect(await send(base)).toBe(404)
    expect(await prisma.booking.count()).toBe(0)
  })

  it('is rate-limited per IP and per guest email', async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    const room = await createRoomType(property.id, { totalRooms: 20 })
    const body = (email: string) => ({ propertyId: property.id, roomTypeId: room.id, guestName: 'Khách', guestEmail: email, guestPhone: '0912345678', ...WEEKDAYS, numAdults: 2 })
    const ip = { 'x-real-ip': '198.51.100.7' }
    const statuses = []
    for (let i = 0; i < 6; i++) statuses.push((await call(guestBooking(json(body(`k${i}@example.com`), ip)))).status)
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])

    const sameEmail = []
    for (let i = 0; i < 4; i++) sameEmail.push((await call(guestBooking(json(body('same@example.com'), freshIp())))).status)
    expect(sameEmail).toEqual([200, 200, 200, 429])
  })

  it('takes no booking for an unpublished site, nor children where the hotel takes none', async () => {
    const { property } = await createTenant()
    const room = await createRoomType(property.id, { maxChildren: 2 })
    const base = { propertyId: property.id, roomTypeId: room.id, ...guest(), ...WEEKDAYS, numAdults: 2 }
    const send = async (body: object) => (await call(guestBooking(json(body, freshIp())))).status

    expect(await send(base)).toBe(404) // never published
    await publishSite(property.id)
    await prisma.websiteSettings.update({ where: { propertyId: property.id }, data: { isPublished: false } })
    expect(await send(base)).toBe(404) // unpublished again

    await publishSite(property.id)
    await prisma.policy.create({ data: { propertyId: property.id, childrenAllowed: false } })
    expect(await send({ ...base, numChildren: 1 })).toBe(400)
    expect(await send(base)).toBe(200)
  })

  it('emails the owner only while the workspace has new booking emails on (Cài đặt → Thông báo)', async () => {
    const { workspace, property } = await createTenant()
    await publishSite(property.id)
    const room = await createRoomType(property.id, { totalRooms: 5 })
    const book = async (n: number) => {
      const res = await call(guestBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(n), ...WEEKDAYS, numAdults: 2 }, freshIp())))
      expect(res.status).toBe(200)
      return prisma.booking.findFirstOrThrow({ where: { bookingCode: res.body.data.bookingCode } })
    }
    const kinds = async (bookingId: string) => (await prisma.emailOutbox.findMany({ where: { refId: bookingId } })).map((m) => m.kind).sort()

    await prisma.workspace.update({ where: { id: workspace.id }, data: { settings: { currency: 'VND', notifications: { newBookingEmail: false } } } })
    // The guest still gets the confirmation; the owner gets no email.
    expect(await kinds((await book(11)).id)).toEqual(['booking_confirmation'])

    await prisma.workspace.update({ where: { id: workspace.id }, data: { settings: { notifications: { newBookingEmail: true } } } })
    expect(await kinds((await book(12)).id)).toEqual(['booking_confirmation', 'owner_new_booking'])
  })

  it("tells the guest it awaits the hotel, with the hotel's times, and escapes the guest in the owner's email", async () => {
    const { property } = await createTenant()
    await publishSite(property.id)
    await prisma.policy.create({ data: { propertyId: property.id, checkInTime: '15:00', checkOutTime: '11:00' } })
    const room = await createRoomType(property.id)
    const name = 'Hoa <a href="https://x.example">bấm</a>'
    const res = await call(
      guestBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(), guestName: name, ...WEEKDAYS, numAdults: 2 }, freshIp()))
    )
    expect(res.status).toBe(200)
    const booking = await prisma.booking.findFirstOrThrow({ where: { bookingCode: res.body.data.bookingCode } })
    const mail = async (kind: string) => {
      const row = await prisma.emailOutbox.findFirstOrThrow({ where: { refId: booking.id, kind } })
      return JSON.parse(decryptSecret(row.message, secretContext('email_outbox', row.id, 'message'))) as { subject: string; html: string; text: string }
    }
    const guestMail = await mail('booking_confirmation')
    // It said "✅ Đặt phòng thành công" before the hotel had seen the request.
    expect(guestMail.subject).toContain('Đã nhận yêu cầu đặt phòng')
    expect(guestMail.html).not.toContain('Đặt phòng thành công')
    expect(guestMail.html).toContain('từ 15:00')
    expect(guestMail.html).toContain('trước 11:00')
    const ownerMail = await mail('owner_new_booking')
    expect(ownerMail.subject).toContain('từ website')
    expect(ownerMail.html).not.toContain('<a href="https://x.example">')
    expect(ownerMail.html).toContain('&lt;a href=')
  })

  it("keeps the page's language: an English booking is confirmed in English, linking to the English pages; the owner's stays Vietnamese", async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://digistay.test')
    try {
      const { owner, property } = await createTenant()
      await publishSite(property.id)
      const room = await createRoomType(property.id, { totalRooms: 10 })
      const book = async (n: number, locale?: unknown) => {
        const res = await call(guestBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(n), ...WEEKDAYS, numAdults: 2, locale }, freshIp())))
        expect(res.status).toBe(200)
        return prisma.booking.findFirstOrThrow({ where: { bookingCode: res.body.data.bookingCode } })
      }
      const mail = async (bookingId: string, kind: string) => {
        const row = await prisma.emailOutbox.findFirstOrThrow({ where: { refId: bookingId, kind } })
        return JSON.parse(decryptSecret(row.message, secretContext('email_outbox', row.id, 'message'))) as { subject: string; html: string; text: string }
      }

      const english = await book(1, 'en')
      expect(english.locale).toBe('en')
      const guestMail = await mail(english.id, 'booking_confirmation')
      expect(guestMail.subject).toBe(`[${english.bookingCode}] Booking request received at ${property.name}`)
      expect(guestMail.html).toContain('<html lang="en">')
      expect(guestMail.html).toContain(`href="https://digistay.test/${property.subdomain}/en"`)
      expect(guestMail.text).toContain('Mon, 7 Dec 2026 - Wed, 9 Dec 2026')
      expect(guestMail.text).toContain(`Hotel website: https://digistay.test/${property.subdomain}/en`)
      expect(guestMail.html).not.toContain('Xin chào')
      // The hotel's owner reads Vietnamese, whatever the guest's language.
      expect((await mail(english.id, 'owner_new_booking')).subject).toContain('Yêu cầu đặt phòng mới từ website')

      // No language, or one the site does not have: Vietnamese, as before.
      for (const [n, locale] of [[2, undefined], [3, 'fr'], [4, { en: true }]] as const) {
        const booking = await book(n, locale)
        expect(booking.locale).toBe('vi')
        const viMail = await mail(booking.id, 'booking_confirmation')
        expect(viMail.subject).toContain('Đã nhận yêu cầu đặt phòng')
        expect(viMail.html).toContain(`href="https://digistay.test/${property.subdomain}"`)
      }

      // Staff bookings stay Vietnamese.
      signInAs(owner)
      const staff = await call(staffBooking(json({ propertyId: property.id, roomTypeId: room.id, ...guest(5), ...WEEKDAYS, numAdults: 2, locale: 'en' })))
      expect(staff.status).toBe(200)
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: staff.body.data.id } })).locale).toBe('vi')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
