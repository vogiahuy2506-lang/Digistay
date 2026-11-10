import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/auth/access', () => ({
  checkPropertyAccess: vi.fn(),
}))

vi.mock('@/lib/billing/guard', () => ({
  lockedResponseForProperty: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/email', () => ({
  sendBookingConfirmation: vi.fn().mockResolvedValue({ success: true, sent: true }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { prisma } from '@/lib/db'
import { POST } from './route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const mockAccess = vi.mocked(checkPropertyAccess)
const mockPrisma = prisma as unknown as {
  booking: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  activityLog: { create: ReturnType<typeof vi.fn> }
}

function post(id: string) {
  return POST(new NextRequest(`http://localhost/api/bookings/${id}/confirm`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  mockAccess.mockResolvedValue({ ok: true } as any)
  mockPrisma.activityLog.create.mockResolvedValue({ id: 'log-1' })
})

describe('POST /api/bookings/[id]/confirm', () => {
  it('returns 401 when signed out', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await post('b-1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when booking not found', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(null)
    const res = await post('b-missing')
    expect(res.status).toBe(404)
  })

  it('returns 400 when booking is cancelled', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'b-cancelled',
      propertyId: 'p-1',
      status: 'CANCELLED',
      property: { id: 'p-1' },
      bookingItems: [],
    })
    const res = await post('b-cancelled')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('đã hủy')
  })

  it('confirms a pending booking and sends email', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'b-pending',
      bookingCode: 'DS1001',
      guestName: 'Nguyen Van A',
      guestEmail: 'a@example.com',
      guestPhone: '0901234567',
      checkInDate: new Date('2026-11-20'),
      checkOutDate: new Date('2026-11-22'),
      numAdults: 2,
      numChildren: 0,
      totalAmount: 1400000,
      status: 'PENDING',
      propertyId: 'p-1',
      property: {
        id: 'p-1',
        name: 'Demo Hotel',
        subdomain: 'demo',
        phone: '0900000000',
        address: '123 Test St',
      },
      bookingItems: [],
    })
    mockPrisma.booking.update.mockResolvedValue({
      id: 'b-pending',
      status: 'CONFIRMED',
    })

    const res = await post('b-pending')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toContain('Đã xác nhận')
    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'b-pending' },
      data: { status: 'CONFIRMED' },
    })
  })
})
