import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processPostStaySurveys } from './post-stay-survey'
import { prisma } from '@/lib/db'
import { queuePostStaySurvey } from '@/lib/email/outbox'

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
  queuePostStaySurvey: vi.fn(),
}))

describe('processPostStaySurveys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = 'review-survey-test-secret'
  })

  it('scans bookings checked out between 24h and 7d ago and sends survey email', async () => {
    const now = new Date('2026-11-02T12:00:00Z')
    const checkIn = new Date('2026-10-28T07:00:00Z')
    const checkOut = new Date('2026-10-31T05:00:00Z') // ~48h ago

    const mockCandidates = [
      {
        id: 'b1',
        guestName: 'Nguyễn Văn A',
        guestEmail: 'vana@example.com',
        locale: 'vi',
        checkInDate: checkIn,
        checkOutDate: checkOut,
        property: {
          id: 'p1',
          name: 'Khách sạn Biển Xanh',
          subdomain: 'bienxanh',
          phone: '0909123456',
        },
        bookingItems: [{ roomTypeId: 'rt1' }],
      },
    ]

    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockCandidates as any)
    vi.mocked(prisma.roomType.findMany).mockResolvedValue([{ id: 'rt1', name: 'Phòng Deluxe' }] as any)
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(queuePostStaySurvey).mockResolvedValue('outbox-1' as any)

    const result = await processPostStaySurveys({ now })

    expect(result.processed).toBe(1)
    expect(result.sent).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', postStayEmailSentAt: null },
      data: { postStayEmailSentAt: now },
    })

    expect(queuePostStaySurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        guestName: 'Nguyễn Văn A',
        guestEmail: 'vana@example.com',
        hotelName: 'Khách sạn Biển Xanh',
        roomName: 'Phòng Deluxe',
        reviewUrl: expect.stringContaining('/danh-gia?token='),
      }),
      'b1'
    )
  })

  it('skips bookings if atomic claim returns count 0 (already claimed)', async () => {
    const now = new Date('2026-11-02T12:00:00Z')
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'b2',
        guestName: 'Trần Thị B',
        guestEmail: 'thib@example.com',
        locale: 'en',
        checkInDate: new Date(),
        checkOutDate: new Date(),
        property: { id: 'p1', name: 'Hotel', subdomain: 'hotel', phone: '0123' },
        bookingItems: [],
      },
    ] as any)
    vi.mocked(prisma.roomType.findMany).mockResolvedValue([])
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 0 })

    const result = await processPostStaySurveys({ now })
    expect(result.sent).toBe(0)
    expect(result.skipped).toBe(1)
    expect(queuePostStaySurvey).not.toHaveBeenCalled()
  })
})
