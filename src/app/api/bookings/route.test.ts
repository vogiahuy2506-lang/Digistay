/**
 * GET /api/bookings must always be scoped to the caller's workspaces,
 * including when no propertyId is passed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    property: { findFirst: vi.fn() },
    booking: { findMany: vi.fn(), count: vi.fn() },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GET } from './route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  property: { findFirst: ReturnType<typeof vi.fn> }
  booking: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }
}

const workspaceAccess = (userId: string) => ({
  OR: [{ ownerId: userId }, { members: { some: { userId } } }],
})

function get(query = '') {
  return GET(new NextRequest(`http://localhost/api/bookings${query}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  mockPrisma.booking.findMany.mockResolvedValue([])
  mockPrisma.booking.count.mockResolvedValue(0)
})

describe('GET /api/bookings', () => {
  it('returns 401 when signed out', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await get()
    expect(res.status).toBe(401)
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled()
  })

  it('without params, lists and counts only bookings in the caller\'s workspaces', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const expected = { property: { workspace: workspaceAccess('user-1') } }
    expect(mockPrisma.booking.findMany.mock.calls[0][0].where).toEqual(expected)
    expect(mockPrisma.booking.count.mock.calls[0][0].where).toEqual(expected)
  })

  it('adds workspaceId (dashboard) on top of the access filter', async () => {
    await get('?workspaceId=ws-9&limit=5')
    expect(mockPrisma.booking.findMany.mock.calls[0][0].where).toEqual({
      property: { workspace: workspaceAccess('user-1'), workspaceId: 'ws-9' },
    })
  })

  it('returns 403 for a propertyId the caller cannot access, without querying bookings', async () => {
    mockPrisma.property.findFirst.mockResolvedValue(null)
    const res = await get('?propertyId=prop-other')
    expect(res.status).toBe(403)
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled()
  })

  it('filters by an accessible propertyId while keeping the access filter', async () => {
    mockPrisma.property.findFirst.mockResolvedValue({ id: 'prop-1' })
    await get('?propertyId=prop-1&status=CONFIRMED')
    expect(mockPrisma.booking.findMany.mock.calls[0][0].where).toEqual({
      property: { workspace: workspaceAccess('user-1') },
      propertyId: 'prop-1',
      status: 'CONFIRMED',
    })
  })
})
