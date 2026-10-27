/**
 * GET /api/bookings must always be scoped to the properties whose bookings
 * the caller may see, including when no propertyId is passed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/auth/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/access')>()),
  checkPropertyAccess: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    roomType: { findMany: vi.fn() },
  },
}))

import { auth } from '@/lib/auth'
import { accessibleProperties, checkPropertyAccess } from '@/lib/auth/access'
import { prisma } from '@/lib/db'
import { GET } from './route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const mockAccess = vi.mocked(checkPropertyAccess)
const mockPrisma = prisma as unknown as {
  booking: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; groupBy: ReturnType<typeof vi.fn> }
  roomType: { findMany: ReturnType<typeof vi.fn> }
}

const granted = { ok: true, userId: 'user-1', property: { id: 'prop-1', workspaceId: 'ws-1' } } as never
const denied = { ok: false, response: new Response(null, { status: 404 }) } as never

function get(query = '') {
  return GET(new NextRequest(`http://localhost/api/bookings${query}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  mockPrisma.booking.findMany.mockResolvedValue([])
  mockPrisma.booking.count.mockResolvedValue(0)
  mockPrisma.booking.groupBy.mockResolvedValue([])
  mockPrisma.roomType.findMany.mockResolvedValue([])
})

describe('GET /api/bookings', () => {
  it('returns 401 when signed out', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await get()
    expect(res.status).toBe(401)
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled()
  })

  it('without params, lists and counts only bookings of properties the caller may see', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const expected = { property: accessibleProperties('user-1', 'bookings_view') }
    expect(mockPrisma.booking.findMany.mock.calls[0][0].where).toEqual(expected)
    expect(mockPrisma.booking.count.mock.calls[0][0].where).toEqual(expected)
  })

  it('adds workspaceId (dashboard) on top of the access filter', async () => {
    await get('?workspaceId=ws-9&limit=5')
    expect(mockPrisma.booking.findMany.mock.calls[0][0].where).toEqual({
      property: { ...accessibleProperties('user-1', 'bookings_view'), workspaceId: 'ws-9' },
    })
  })

  it('returns 403 for a propertyId the caller cannot access, without querying bookings', async () => {
    mockAccess.mockResolvedValue(denied)
    const res = await get('?propertyId=prop-other')
    expect(res.status).toBe(403)
    expect(mockAccess).toHaveBeenCalledWith('user-1', 'prop-other', 'bookings_view')
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled()
  })

  it('filters by an accessible propertyId while keeping the access filter', async () => {
    mockAccess.mockResolvedValue(granted)
    await get('?propertyId=prop-1&status=CONFIRMED')
    expect(mockPrisma.booking.findMany.mock.calls[0][0].where).toEqual({
      property: accessibleProperties('user-1', 'bookings_view'),
      propertyId: 'prop-1',
      status: 'CONFIRMED',
    })
  })

  it.each([
    ['status', 'NOT_A_STATUS'],
    ['paymentStatus', 'free'],
    ['source', 'ZALO'],
  ])('rejects an unknown %s value with 400 instead of a Prisma 500', async (key, value) => {
    const res = await get(`?${key}=${value}`)
    expect(res.status).toBe(400)
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled()
  })

  it('searches code, name and phone in the database, inside the access filter', async () => {
    await get('?q=%20MB-10%20')
    const where = mockPrisma.booking.findMany.mock.calls[0][0].where
    expect(where.property).toEqual(accessibleProperties('user-1', 'bookings_view'))
    expect(where.OR).toEqual([
      { bookingCode: { contains: 'MB-10', mode: 'insensitive' } },
      { guestName: { contains: 'MB-10', mode: 'insensitive' } },
      { guestPhone: { contains: 'MB-10' } },
    ])
  })

  it('caps limit at 100 and falls back on garbage page/limit', async () => {
    await get('?limit=100000&page=abc')
    expect(mockPrisma.booking.findMany.mock.calls[0][0]).toMatchObject({ take: 100, skip: 0 })
    await get('?limit=-5&page=3')
    expect(mockPrisma.booking.findMany.mock.calls[1][0]).toMatchObject({ take: 20, skip: 40 })
  })

  it('counts per status only when asked, with every filter but the status', async () => {
    mockAccess.mockResolvedValue(granted)
    mockPrisma.booking.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 } },
      { status: 'CHECKED_IN', _count: { _all: 1 } },
    ])
    const body = await (await get('?propertyId=prop-1&status=PENDING&source=OTA&counts=1')).json()
    expect(mockPrisma.booking.groupBy.mock.calls[0][0].where).toEqual({
      property: accessibleProperties('user-1', 'bookings_view'),
      propertyId: 'prop-1',
      source: 'OTA',
    })
    expect(body.statusCounts).toEqual({
      ALL: 3, PENDING: 2, CONFIRMED: 0, CHECKED_IN: 1, CHECKED_OUT: 0, CANCELLED: 0, NO_SHOW: 0,
    })

    vi.clearAllMocks()
    mockPrisma.booking.findMany.mockResolvedValue([])
    const plain = await (await get()).json()
    expect(mockPrisma.booking.groupBy).not.toHaveBeenCalled()
    expect(plain.statusCounts).toBeUndefined()
  })

  it('adds room type names to booking items with one lookup', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      { id: 'b1', bookingItems: [{ roomTypeId: 'rt-1' }, { roomTypeId: 'rt-gone' }] },
      { id: 'b2', bookingItems: [{ roomTypeId: 'rt-1' }] },
    ])
    mockPrisma.roomType.findMany.mockResolvedValue([{ id: 'rt-1', name: 'Deluxe Hướng Biển' }])
    const body = await (await get()).json()
    expect(mockPrisma.roomType.findMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.roomType.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['rt-1', 'rt-gone'] } })
    expect(body.data[0].bookingItems.map((i: { roomTypeName: string | null }) => i.roomTypeName)).toEqual([
      'Deluxe Hướng Biển',
      null,
    ])
  })
})
