/**
 * Every /api/bookings/[id] route answers someone outside the booking's
 * workspace with the 404 of a missing booking (CLAUDE.md, API rule 3): a
 * 403 for a real id told them it exists. Members without the role still get
 * 403. Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import * as bookingRoute from './route'
import * as checkInRoute from './check-in/route'
import * as checkOutRoute from './check-out/route'
import * as cancelRoute from './cancel/route'
import * as noShowRoute from './no-show/route'
import * as extendRoute from './extend/route'
import * as roomRoute from './room/route'
import * as sendConfirmationRoute from './send-confirmation/route'

type Handler = (request: NextRequest, props: { params: Promise<{ id: string }> }) => Promise<Response>

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

const call = async (handler: Handler, method: string, id: string, body?: object) => {
  const res = await handler(
    new NextRequest(`http://localhost/api/bookings/${id}`, {
      method,
      ...(body && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    }),
    { params: Promise.resolve({ id }) }
  )
  return res.status
}

/** Every handler under /api/bookings/[id], with a body it accepts. */
const ROUTES: [string, Handler, string, object?][] = [
  ['GET /api/bookings/[id]', bookingRoute.GET, 'GET'],
  ['PATCH /api/bookings/[id]', bookingRoute.PATCH, 'PATCH', { guestNote: 'x' }],
  ['DELETE /api/bookings/[id]', bookingRoute.DELETE, 'DELETE'],
  ['POST check-in', checkInRoute.POST, 'POST'],
  ['GET check-out', checkOutRoute.GET, 'GET'],
  ['POST check-out', checkOutRoute.POST, 'POST', {}],
  ['GET cancel', cancelRoute.GET, 'GET'],
  ['POST cancel', cancelRoute.POST, 'POST', {}],
  ['POST no-show', noShowRoute.POST, 'POST'],
  ['POST extend', extendRoute.POST, 'POST', { newCheckOutDate: '2026-11-05' }],
  ['POST room', roomRoute.POST, 'POST', { roomId: null }],
  ['POST send-confirmation', sendConfirmationRoute.POST, 'POST'],
]

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('/api/bookings/[id]/* for someone outside the workspace', () => {
  it.each(ROUTES)('%s: 404 for a real booking, the same as for a missing one', async (_name, handler, method, body) => {
    const { property } = await createTenant()
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    signInAs(await createUser())

    expect(await call(handler, method, booking.id, body)).toBe(404)
    expect(await call(handler, method, 'doesnotexist123', body)).toBe(404)

    // Nothing changed.
    const after = await prisma.booking.findUnique({ where: { id: booking.id }, select: { status: true, guestNote: true } })
    expect(after).toEqual({ status: 'CONFIRMED', guestNote: null })
  })
})

describe('/api/bookings/[id]/* for a member without the role', () => {
  it.each([
    ['POST check-in', checkInRoute.POST, 'POST'],
    ['PATCH /api/bookings/[id]', bookingRoute.PATCH, 'PATCH', { guestNote: 'x' }],
    ['POST room', roomRoute.POST, 'POST', { roomId: null }],
    ['POST no-show', noShowRoute.POST, 'POST'],
  ] as [string, Handler, string, object?][])('%s: 403', async (_name, handler, method, body) => {
    const { property, member } = await createTenant({ memberRole: 'USER' })
    const booking = await createBooking(property.id, { status: 'CONFIRMED' })
    signInAs(member!)

    expect(await call(handler, method, booking.id, body)).toBe(403)
  })

  it('GET: a member reads the booking', async () => {
    const { property, member } = await createTenant({ memberRole: 'USER' })
    const booking = await createBooking(property.id)
    signInAs(member!)

    expect(await call(bookingRoute.GET, 'GET', booking.id)).toBe(200)
  })
})
