import { describe, expect, it, vi, beforeEach } from 'vitest'
import { processAbandonedBookings } from './abandoned-cart'
import { abandonedCartTemplate } from '@/lib/email/templates'
import { prisma } from '@/lib/db'
import * as outbox from '@/lib/email/outbox'

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    roomType: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email/outbox', () => ({
  queueAbandonedCart: vi.fn().mockResolvedValue('outbox_123'),
}))

describe('Task 48: Abandoned Cart Reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = 'deposit-link-test-secret'
  })

  describe('abandonedCartTemplate', () => {
    it('renders localized Vietnamese template with stay details and CTA button', () => {
      const rendered = abandonedCartTemplate({
        guestName: 'Nguyễn Văn A',
        guestEmail: 'a@example.com',
        hotelName: 'Khách sạn Mây Biển',
        hotelPhone: '0901234567',
        roomName: 'Deluxe Hướng Biển',
        checkIn: new Date('2026-12-25T14:00:00.000Z'),
        checkOut: new Date('2026-12-27T12:00:00.000Z'),
        totalAmount: 2_500_000,
        continueUrl: 'https://maybien.digistay.vn/dat-coc/token123',
        locale: 'vi',
      })

      expect(rendered.subject).toContain('Khách sạn Mây Biển')
      expect(rendered.html).toContain('Deluxe Hướng Biển')
      expect(rendered.html).toContain('2.500.000')
      expect(rendered.html).toContain('https://maybien.digistay.vn/dat-coc/token123')
      expect(rendered.html).toContain('0901234567')
      expect(rendered.text).toContain('Tiếp tục đặt phòng')
    })

    it('renders English template when guest locale is en', () => {
      const rendered = abandonedCartTemplate({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        hotelName: 'Ocean View Resort',
        hotelPhone: '+84901234567',
        roomName: 'Ocean Suite',
        checkIn: new Date('2026-12-25T14:00:00.000Z'),
        checkOut: new Date('2026-12-27T12:00:00.000Z'),
        totalAmount: 3_000_000,
        continueUrl: 'https://oceanview.digistay.vn/en/dat-coc/token123',
        locale: 'en',
      })

      expect(rendered.subject).toBe('Your stay at Ocean View Resort is waiting to be completed!')
      expect(rendered.html).toContain('Ocean Suite')
      expect(rendered.html).toContain('Continue Booking &amp; Hold Room')
      expect(rendered.text).toContain('Continue booking:')
    })
  })

  describe('processAbandonedBookings query & processing logic', () => {
    it('queries bookings within 2h to 12h window with PENDING status and no prior abandoned email', async () => {
      const now = new Date('2026-11-02T12:00:00.000Z')
      const mockFindMany = vi.mocked(prisma.booking.findMany).mockResolvedValue([])

      await processAbandonedBookings({ now })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            abandonedEmailSentAt: null,
            guestEmail: { not: '', contains: '@' },
            createdAt: {
              gte: new Date('2026-11-02T00:00:00.000Z'), // 12h ago
              lte: new Date('2026-11-02T10:00:00.000Z'), // 2h ago
            },
          }),
        })
      )
    })

    it('claims candidate atomically and enqueues reminder email into outbox', async () => {
      const now = new Date('2026-11-02T12:00:00.000Z')
      const mockBooking = {
        id: 'book_123',
        guestName: 'Trần Thị B',
        guestEmail: 'b@example.com',
        locale: 'vi',
        totalAmount: 1_200_000,
        checkInDate: new Date('2026-11-10T14:00:00.000Z'),
        checkOutDate: new Date('2026-11-12T12:00:00.000Z'),
        property: {
          id: 'prop_1',
          name: 'Homestay Hội An',
          subdomain: 'hoian',
          phone: '0988776655',
        },
        bookingItems: [
          {
            roomTypeId: 'rt_1',
          },
        ],
      } as any

      vi.mocked(prisma.booking.findMany).mockResolvedValue([mockBooking])
      vi.mocked(prisma.roomType.findMany).mockResolvedValue([{ id: 'rt_1', name: 'Phòng Ban Công' }] as any)
      vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 1 })

      const result = await processAbandonedBookings({ now })

      expect(result.processed).toBe(1)
      expect(result.sent).toBe(1)
      expect(result.errors).toBe(0)

      // Verifies atomic claim
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'book_123',
          status: 'PENDING',
          abandonedEmailSentAt: null,
        },
        data: {
          abandonedEmailSentAt: now,
        },
      })

      // Verifies outbox queueing
      expect(outbox.queueAbandonedCart).toHaveBeenCalledWith(
        expect.objectContaining({
          guestName: 'Trần Thị B',
          guestEmail: 'b@example.com',
          hotelName: 'Homestay Hội An',
          roomName: 'Phòng Ban Công',
          totalAmount: 1_200_000,
        }),
        'book_123'
      )
    })

    it('skips booking if another worker concurrently claimed it (updateMany count = 0)', async () => {
      const now = new Date('2026-11-02T12:00:00.000Z')
      const mockBooking = {
        id: 'book_concurrent',
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        property: { name: 'Hotel', subdomain: 'hotel', phone: null },
        bookingItems: [],
        checkInDate: new Date(),
        checkOutDate: new Date(),
        totalAmount: 500_000,
      } as any

      vi.mocked(prisma.booking.findMany).mockResolvedValue([mockBooking])
      vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 0 }) // claimed elsewhere

      const result = await processAbandonedBookings({ now })

      expect(result.processed).toBe(1)
      expect(result.sent).toBe(0)
      expect(result.skipped).toBe(1)
      expect(outbox.queueAbandonedCart).not.toHaveBeenCalled()
    })
  })
})
