import { describe, it, expect, vi } from 'vitest'
import { syncCustomerProfileFromBooking } from './sync-customer'

describe('syncCustomerProfileFromBooking', () => {
  it('returns null if booking is not found', async () => {
    const mockDb = {
      booking: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as any

    const result = await syncCustomerProfileFromBooking(mockDb, 'non-existent')
    expect(result).toBeNull()
  })

  it('returns null if both email and phone are missing', async () => {
    const mockDb = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'b1',
          propertyId: 'p1',
          guestName: 'Anonymous',
          guestEmail: '',
          guestPhone: '',
          status: 'CHECKED_OUT',
          paymentStatus: 'PAID',
        }),
      },
    } as any

    const result = await syncCustomerProfileFromBooking(mockDb, 'b1')
    expect(result).toBeNull()
  })

  it('creates new CustomerProfile with calculated totals and automatic tag', async () => {
    const pastBookings = [
      {
        id: 'b1',
        status: 'CHECKED_OUT',
        paymentStatus: 'PAID',
        totalAmount: 1_200_000,
        depositAmount: 1_200_000,
        checkInDate: new Date('2026-05-01'),
        checkOutDate: new Date('2026-05-03'),
        actualCheckOut: new Date('2026-05-03'),
        createdAt: new Date('2026-04-20'),
      },
      {
        id: 'b2',
        status: 'CHECKED_OUT',
        paymentStatus: 'PAID',
        totalAmount: 800_000,
        depositAmount: 800_000,
        checkInDate: new Date('2026-06-10'),
        checkOutDate: new Date('2026-06-12'),
        actualCheckOut: new Date('2026-06-12'),
        createdAt: new Date('2026-06-01'),
      },
    ]

    const mockDb = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'b2',
          propertyId: 'p1',
          guestName: 'Nguyễn Văn A',
          guestEmail: 'vana@example.com',
          guestPhone: '0901234567',
          status: 'CHECKED_OUT',
          paymentStatus: 'PAID',
        }),
        findMany: vi.fn().mockResolvedValue(pastBookings),
      },
      customerProfile: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data })),
      },
    } as any

    const result = await syncCustomerProfileFromBooking(mockDb, 'b2')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Nguyễn Văn A')
    expect(result!.email).toBe('vana@example.com')
    expect(result!.phone).toBe('0901234567')
    expect(result!.totalStays).toBe(2)
    expect(result!.totalSpent).toBe(2_000_000)
    expect(result!.tags).toContain('Khách quen')
  })

  it('updates existing CustomerProfile and preserves manual tags and notes', async () => {
    const pastBookings = [
      {
        id: 'b1',
        status: 'CHECKED_OUT',
        paymentStatus: 'PAID',
        totalAmount: 5_000_000,
        depositAmount: 5_000_000,
        checkInDate: new Date('2026-07-01'),
        checkOutDate: new Date('2026-07-05'),
        actualCheckOut: new Date('2026-07-05'),
        createdAt: new Date('2026-06-25'),
      },
    ]

    const existingProfile = {
      id: 'c1',
      propertyId: 'p1',
      email: 'vana@example.com',
      phone: '0901234567',
      name: 'Anh An',
      notes: 'Thích tầng cao, view biển',
      tags: ['Khách công vụ'],
      totalStays: 0,
      totalSpent: 0,
      lastStayAt: null,
    }

    const mockDb = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'b1',
          propertyId: 'p1',
          guestName: 'Nguyễn Văn An',
          guestEmail: 'vana@example.com',
          guestPhone: '0901234567',
          status: 'CHECKED_OUT',
          paymentStatus: 'PAID',
        }),
        findMany: vi.fn().mockResolvedValue(pastBookings),
      },
      customerProfile: {
        findFirst: vi.fn().mockResolvedValue(existingProfile),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...existingProfile, ...data })),
      },
    } as any

    const result = await syncCustomerProfileFromBooking(mockDb, 'b1')
    expect(result).not.toBeNull()
    expect(result!.totalStays).toBe(1)
    expect(result!.totalSpent).toBe(5_000_000)
    expect(result!.tags).toContain('Khách công vụ')
    expect(mockDb.customerProfile.update).toHaveBeenCalled()
  })
})
