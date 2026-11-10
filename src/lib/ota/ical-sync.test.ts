import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatIcalDate,
  formatIcalDateTime,
  parseIcalRawDate,
  parseIcalString,
  generateIcalExportFeed,
} from './ical-sync'

vi.mock('@/lib/db', () => ({
  prisma: {
    icalSyncFeed: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    roomLock: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

describe('iCal Sync Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatIcalDate and formatIcalDateTime', () => {
    it('formats a Date to UTC YYYYMMDD string', () => {
      const d = new Date(Date.UTC(2026, 10, 15, 14, 30, 0))
      expect(formatIcalDate(d)).toBe('20261115')
    })

    it('formats a Date to UTC YYYYMMDDTHHMMSSZ string', () => {
      const d = new Date(Date.UTC(2026, 10, 15, 14, 30, 0))
      expect(formatIcalDateTime(d)).toBe('20261115T143000Z')
    })
  })

  describe('parseIcalRawDate', () => {
    it('parses YYYYMMDD date', () => {
      const parsed = parseIcalRawDate('20261120')
      expect(parsed).not.toBeNull()
      expect(parsed?.getUTCFullYear()).toBe(2026)
      expect(parsed?.getUTCMonth()).toBe(10) // Nov
      expect(parsed?.getUTCDate()).toBe(20)
    })

    it('parses YYYYMMDD with VALUE=DATE prefix', () => {
      const parsed = parseIcalRawDate('VALUE=DATE:20261120')
      expect(parsed).not.toBeNull()
      expect(parsed?.getUTCDate()).toBe(20)
    })

    it('parses YYYYMMDDTHHMMSSZ date time', () => {
      const parsed = parseIcalRawDate('20261120T120000Z')
      expect(parsed).not.toBeNull()
      expect(parsed?.getUTCHours()).toBe(12)
    })

    it('returns null for invalid strings', () => {
      expect(parseIcalRawDate('invalid-date')).toBeNull()
    })
  })

  describe('parseIcalString', () => {
    it('parses standard iCalendar events with unfolding', () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Airbnb Inc//Hosting Calendar 0.8//EN',
        'BEGIN:VEVENT',
        'UID:reservation-12345@airbnb.com',
        'DTSTART;VALUE=DATE:20261125',
        'DTEND;VALUE=DATE:20261128',
        'SUMMARY:Reserved (Not available)',
        'DESCRIPTION:Reservation URL: https://airbnb.com/hosting/reservations/',
        ' details/12345',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:reservation-67890@airbnb.com',
        'DTSTART:20261201T140000Z',
        'DTEND:20261205T100000Z',
        'SUMMARY:Booking.com Closed',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n')

      const events = parseIcalString(ics)
      expect(events).toHaveLength(2)

      expect(events[0].uid).toBe('reservation-12345@airbnb.com')
      expect(events[0].summary).toBe('Reserved (Not available)')
      expect(events[0].description).toBe(
        'Reservation URL: https://airbnb.com/hosting/reservations/details/12345'
      )
      expect(events[0].start.getUTCDate()).toBe(25)
      expect(events[0].end.getUTCDate()).toBe(28)

      expect(events[1].uid).toBe('reservation-67890@airbnb.com')
      expect(events[1].summary).toBe('Booking.com Closed')
    })

    it('ignores non-event blocks and handles empty input', () => {
      expect(parseIcalString('')).toEqual([])
      expect(parseIcalString('BEGIN:VCALENDAR\nEND:VCALENDAR')).toEqual([])
    })
  })

  describe('generateIcalExportFeed', () => {
    it('generates standard RFC 5545 iCal content with bookings and locks', async () => {
      const mockFeed = {
        id: 'feed_1',
        exportToken: 'token_abc',
        propertyId: 'prop_1',
        roomTypeId: 'rt_1',
        isActive: true,
        property: { id: 'prop_1', name: 'Digistay Boutique Hotel' },
        roomType: { id: 'rt_1', name: 'Deluxe Ocean View' },
      }

      const mockBookings = [
        {
          id: 'bk_1',
          bookingCode: 'BK-2026-001',
          guestName: 'Nguyễn Văn A',
          checkInDate: new Date(Date.UTC(2026, 10, 20)),
          checkOutDate: new Date(Date.UTC(2026, 10, 23)),
          createdAt: new Date(Date.UTC(2026, 10, 10, 8, 0, 0)),
          source: 'WEBSITE',
        },
      ]

      const mockLocks = [
        {
          id: 'lock_1',
          lockStart: new Date(Date.UTC(2026, 10, 24)),
          lockEnd: new Date(Date.UTC(2026, 10, 25)),
          notes: 'Thay điều hòa',
          type: 'MAINTENANCE',
          createdAt: new Date(Date.UTC(2026, 10, 10, 9, 0, 0)),
        },
      ]

      vi.mocked(prisma.icalSyncFeed.findUnique).mockResolvedValueOnce(mockFeed as any)
      vi.mocked(prisma.booking.findMany).mockResolvedValueOnce(mockBookings as any)
      vi.mocked(prisma.roomLock.findMany).mockResolvedValueOnce(mockLocks as any)

      const result = await generateIcalExportFeed('token_abc')
      expect(result).not.toBeNull()
      expect(result?.feedName).toBe('Digistay Boutique Hotel - Deluxe Ocean View')

      const ics = result?.ics || ''
      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('PRODID:-//Digistay PMS//iCal Sync 1.0//VI')
      expect(ics).toContain('UID:booking-bk_1@digistay.vn')
      expect(ics).toContain('SUMMARY:Digistay Đặt phòng BK-2026-001')
      expect(ics).toContain('DTSTART;VALUE=DATE:20261120')
      expect(ics).toContain('DTEND;VALUE=DATE:20261123')
      expect(ics).toContain('UID:lock-lock_1@digistay.vn')
      expect(ics).toContain('SUMMARY:Bảo trì phòng')
      expect(ics).toContain('END:VCALENDAR')
    })

    it('returns null if feed is not found or inactive', async () => {
      vi.mocked(prisma.icalSyncFeed.findUnique).mockResolvedValueOnce(null)
      const res = await generateIcalExportFeed('invalid_token')
      expect(res).toBeNull()
    })
  })
})
