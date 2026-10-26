/**
 * Creating and editing a room type from the "Hạng phòng" page: the capacity
 * it is given is the one saved (the form used to save 2 adults, 0 children
 * whatever "up to N guests" said), its maximum is not below the base guests
 * or the adults (src/lib/bookings/capacity.ts), and the slug spells
 * Vietnamese out.
 * Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), authOptions: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { POST as createRoomTypeRoute } from './route'
import { PUT as putRoomType } from './[id]/route'
import { createRoomType, createTenant, resetDatabase } from '@/test/integration/fixtures'

function signInAs(user: { id: string; email: string }) {
  ;(getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: user.id, email: user.email } })
}

const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const form = (propertyId: string, fields: Record<string, unknown> = {}) => ({
  propertyId,
  name: 'QA Phòng Đơn',
  bedType: 'SINGLE',
  totalRooms: 1,
  baseOccupancy: 1,
  maxOccupancy: 3,
  maxAdults: 2,
  maxChildren: 1,
  weekdayPrice: 600_000,
  weekendPrice: 600_000,
  area: null,
  ...fields,
})

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/room-types', () => {
  it('saves the capacity it is given and a transliterated, unique slug', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)

    const res = await createRoomTypeRoute(req('/api/room-types', 'POST', form(property.id)))
    expect(res.status).toBe(201)
    const again = await createRoomTypeRoute(req('/api/room-types', 'POST', form(property.id)))
    expect(again.status).toBe(201)

    const types = await prisma.roomType.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: 'asc' },
      select: { slug: true, maxAdults: true, maxChildren: true, maxOccupancy: true, baseOccupancy: true, area: true },
    })
    expect(types).toEqual([
      { slug: 'qa-phong-don', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, baseOccupancy: 1, area: null },
      { slug: 'qa-phong-don-1', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, baseOccupancy: 1, area: null },
    ])
  })

  it('refuses a capacity that does not hang together, or out of range', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)

    for (const fields of [
      { maxOccupancy: 3, maxAdults: 4 },
      { baseOccupancy: 4, maxOccupancy: 3 },
      { maxAdults: 0 },
      { maxChildren: 11 },
    ]) {
      const res = await createRoomTypeRoute(req('/api/room-types', 'POST', form(property.id, fields)))
      expect(res.status, JSON.stringify(fields)).toBe(400)
    }
    const res = await createRoomTypeRoute(req('/api/room-types', 'POST', form(property.id, { baseOccupancy: 4, maxOccupancy: 3 })))
    expect((await res.json()).error).toBe('Sức chứa không hợp lệ: kiểm tra lại số khách và số người lớn, trẻ em tối đa')
    expect(await prisma.roomType.count()).toBe(0)
  })
})

describe('PUT /api/room-types/[id]', () => {
  it('checks a capacity change against what the type already has', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const type = await createRoomType(property.id, { baseOccupancy: 2, maxOccupancy: 3, maxAdults: 2, maxChildren: 1 })
    const put = (body: unknown) => putRoomType(req(`/api/room-types/${type.id}`, 'PUT', body), { params: Promise.resolve({ id: type.id }) })

    expect((await put({ maxAdults: 4 })).status).toBe(400)
    expect((await put({ baseOccupancy: 4 })).status).toBe(400)
    expect((await put({ maxAdults: 3, maxChildren: 2, maxOccupancy: 4 })).status).toBe(200)
    // Fields other than the capacity are not checked against it.
    expect((await put({ name: 'Deluxe' })).status).toBe(200)

    expect(await prisma.roomType.findUnique({ where: { id: type.id }, select: { maxAdults: true, maxChildren: true, maxOccupancy: true } })).toEqual({
      maxAdults: 3,
      maxChildren: 2,
      maxOccupancy: 4,
    })
  })
})
