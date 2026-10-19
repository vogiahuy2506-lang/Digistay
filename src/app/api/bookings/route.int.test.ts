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
})
