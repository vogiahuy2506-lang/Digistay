import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  calculateRoomAvailability,
  syncRoomAvailabilityToChannels,
  verifyOtaWebhookSignature,
  processOtaInboundWebhook,
} from './sync-engine'
import { createHmac } from 'crypto'

vi.mock('@/lib/db', () => ({
  prisma: {
    roomType: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bookingItem: {
      create: vi.fn(),
    },
    room: {
      findFirst: vi.fn(),
    },
    roomLock: {
      findMany: vi.fn(),
    },
    channelAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    channelSyncLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/bookings/occupancy', () => ({
  roomsTaken: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/notifications', () => ({
  notifyNewBooking: vi.fn().mockResolvedValue(undefined),
}))

describe('OTA Sync Engine (Task 56)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateRoomAvailability', () => {
    it('calculates available rooms by subtracting bookings and room locks', async () => {
      vi.mocked(prisma.roomType.findFirst).mockResolvedValueOnce({
        id: 'rt-1',
        totalRooms: 5,
        isActive: true,
        pricing: [{ weekdayPrice: 500000 }],
        rooms: [{ id: 'r1', isActive: true }, { id: 'r2', isActive: true }, { id: 'r3', isActive: true }, { id: 'r4', isActive: true }, { id: 'r5', isActive: true }],
      } as any)

      const start = new Date('2026-12-01')
      const end = new Date('2026-12-03')

      // 1 booking on night 1
      vi.mocked(prisma.booking.findMany).mockResolvedValueOnce([
        {
          id: 'b1',
          checkInDate: new Date('2026-12-01'),
          checkOutDate: new Date('2026-12-02'),
          bookingItems: [{ roomTypeId: 'rt-1' }],
        },
      ] as any)

      // 1 lock on night 1 & 2
      vi.mocked(prisma.roomLock.findMany).mockResolvedValueOnce([
        {
          id: 'l1',
          lockStart: new Date('2026-12-01'),
          lockEnd: new Date('2026-12-03'),
        },
      ] as any)

      const res = await calculateRoomAvailability('prop-1', 'rt-1', start, end)

      expect(res).toHaveLength(2)
      // Night 1: 5 - (1 booking + 1 lock) = 3
      expect(res[0].availableRooms).toBe(3)
      expect(res[0].totalRooms).toBe(5)
      expect(res[0].basePrice).toBe(500000)

      // Night 2: 5 - (0 bookings + 1 lock) = 4
      expect(res[1].availableRooms).toBe(4)
    })
  })

  describe('syncRoomAvailabilityToChannels (Outbound)', () => {
    it('pushes availability out to all active channels and writes sync logs', async () => {
      vi.mocked(prisma.channelAccount.findMany).mockResolvedValueOnce([
        {
          id: 'acc-agoda',
          propertyId: 'prop-1',
          channel: 'AGODA',
          isActive: true,
          rateMultiplierDefault: 1.15,
          mappings: [
            {
              id: 'map-1',
              channelAccountId: 'acc-agoda',
              roomTypeId: 'rt-1',
              channelRoomId: 'AGODA_R101',
              channelRatePlanId: 'STD',
              rateMultiplier: 1.15,
              isSyncEnabled: true,
            },
          ],
        },
      ] as any)

      // calculateRoomAvailability mocks
      vi.mocked(prisma.roomType.findFirst).mockResolvedValueOnce({
        id: 'rt-1',
        totalRooms: 3,
        isActive: true,
        pricing: [{ weekdayPrice: 1000000 }],
        rooms: [],
      } as any)
      vi.mocked(prisma.booking.findMany).mockResolvedValueOnce([])
      vi.mocked(prisma.roomLock.findMany).mockResolvedValueOnce([])

      const result = await syncRoomAvailabilityToChannels('prop-1', {
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-02'),
      })

      expect(result.syncedChannels).toBe(1)
      expect(result.syncedRooms).toBe(1)
      expect(result.success).toBe(true)
      expect(prisma.channelSyncLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelAccountId: 'acc-agoda',
            direction: 'OUTBOUND_AVAILABILITY',
            status: 'SUCCESS',
          }),
        })
      )
      expect(prisma.channelAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-agoda' },
          data: expect.objectContaining({ lastSyncedAt: expect.any(Date) }),
        })
      )
    })
  })

  describe('verifyOtaWebhookSignature', () => {
    it('verifies valid HMAC-SHA256 signature and rejects invalid ones', () => {
      const secret = 'replace-me-webhook-secret-123'
      const body = JSON.stringify({ action: 'BOOKING_NEW', id: '123' })
      const signature = createHmac('sha256', secret).update(body).digest('hex')

      expect(verifyOtaWebhookSignature(secret, body, signature)).toBe(true)
      expect(verifyOtaWebhookSignature(secret, body, `sha256=${signature}`)).toBe(true)
      expect(verifyOtaWebhookSignature(secret, body, 'invalid-signature')).toBe(false)
      expect(verifyOtaWebhookSignature('', body, null)).toBe(true)
    })
  })

  describe('processOtaInboundWebhook (Inbound)', () => {
    it('handles new booking with idempotency and room assignment', async () => {
      vi.mocked(prisma.channelAccount.findFirst).mockResolvedValueOnce({
        id: 'acc-bk',
        propertyId: 'prop-1',
        channel: 'BOOKING_COM',
        hotelIdentifier: 'BK-777',
        isActive: true,
        encryptedConfig: '',
        mappings: [
          {
            id: 'm1',
            channelRoomId: 'BK_DELUXE',
            roomTypeId: 'rt-deluxe',
            isSyncEnabled: true,
          },
        ],
      } as any)

      // First call: No existing booking
      vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.roomType.findUnique).mockResolvedValueOnce({
        id: 'rt-deluxe',
        totalRooms: 5,
        name: 'Deluxe Room',
      } as any)

      // Transaction mock
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          room: { findFirst: vi.fn().mockResolvedValue({ id: 'room-101', number: '101' }) },
          booking: {
            create: vi.fn().mockResolvedValue({
              id: 'b-new-1',
              bookingCode: 'OTA-BK-TEST1',
              totalAmount: 1500000,
            }),
          },
          bookingItem: { create: vi.fn().mockResolvedValue({}) },
          channelSyncLog: { create: vi.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await processOtaInboundWebhook(
        'BOOKING_COM',
        {
          action: 'BOOKING_NEW',
          channelBookingId: 'BOOKING-998877',
          hotelIdentifier: 'BK-777',
          channelRoomId: 'BK_DELUXE',
          checkInDate: '2026-12-10',
          checkOutDate: '2026-12-12',
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          totalAmount: 1500000,
        },
        { bypassSecretCheck: true }
      )

      expect(res.success).toBe(true)
      expect(res.bookingCode).toBe('OTA-BK-TEST1')
    })

    it('enforces idempotency when receiving the same channelBookingId twice', async () => {
      vi.mocked(prisma.channelAccount.findFirst).mockResolvedValueOnce({
        id: 'acc-bk',
        propertyId: 'prop-1',
        channel: 'BOOKING_COM',
        hotelIdentifier: 'BK-777',
        isActive: true,
        encryptedConfig: '',
        mappings: [],
      } as any)

      // Already exists in DB
      vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
        id: 'b-existing-1',
        bookingCode: 'OTA-BK-EXISTING',
      } as any)

      const res = await processOtaInboundWebhook(
        'BOOKING_COM',
        {
          action: 'BOOKING_NEW',
          channelBookingId: 'BOOKING-DUPLICATE',
          hotelIdentifier: 'BK-777',
        },
        { bypassSecretCheck: true }
      )

      expect(res.success).toBe(true)
      expect(res.isDuplicate).toBe(true)
      expect(res.bookingCode).toBe('OTA-BK-EXISTING')
      expect(prisma.booking.create).not.toHaveBeenCalled()
    })

    it('cancels existing booking when receiving BOOKING_CANCEL', async () => {
      vi.mocked(prisma.channelAccount.findFirst).mockResolvedValueOnce({
        id: 'acc-bk',
        propertyId: 'prop-1',
        channel: 'BOOKING_COM',
        hotelIdentifier: 'BK-777',
        isActive: true,
        encryptedConfig: '',
        mappings: [],
      } as any)

      vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
        id: 'b-to-cancel',
        bookingCode: 'OTA-BK-CANCEL',
        status: 'CONFIRMED',
        checkInDate: new Date('2026-12-10'),
        checkOutDate: new Date('2026-12-12'),
      } as any)

      const res = await processOtaInboundWebhook(
        'BOOKING_COM',
        {
          action: 'BOOKING_CANCEL',
          channelBookingId: 'BOOKING-CANCEL-123',
          hotelIdentifier: 'BK-777',
          cancellationReason: 'Guest requested date change',
        },
        { bypassSecretCheck: true }
      )

      expect(res.success).toBe(true)
      expect(res.action).toBe('BOOKING_CANCEL')
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-to-cancel' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
      )
    })
  })
})
