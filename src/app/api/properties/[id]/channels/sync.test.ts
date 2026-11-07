import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as handleWebhook } from '@/app/api/webhooks/channels/[channel]/route'
import { POST as handleManualSync } from './sync/route'
import { GET as handleGetLogs } from './logs/route'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { processOtaInboundWebhook, syncRoomAvailabilityToChannels } from '@/lib/ota/sync-engine'
import { prisma } from '@/lib/db'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/auth/access', () => ({
  accessibleProperties: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/ota/sync-engine', () => ({
  processOtaInboundWebhook: vi.fn(),
  syncRoomAvailabilityToChannels: vi.fn(),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  hit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSec: 0 }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    property: {
      findFirst: vi.fn(),
    },
    channelSyncLog: {
      findMany: vi.fn(),
    },
  },
}))

describe('OTA Webhooks & Sync API (Task 56)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/webhooks/channels/[channel]', () => {
    it('rejects invalid channel', async () => {
      const req = new NextRequest('http://localhost/api/webhooks/channels/UNKNOWN_CHANNEL', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const res = await handleWebhook(req, { params: Promise.resolve({ channel: 'UNKNOWN_CHANNEL' }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Kênh phân phối không hợp lệ')
    })

    it('rejects missing hotelIdentifier and channelBookingId', async () => {
      const req = new NextRequest('http://localhost/api/webhooks/channels/agoda', {
        method: 'POST',
        body: JSON.stringify({ action: 'BOOKING_NEW' }),
      })
      const res = await handleWebhook(req, { params: Promise.resolve({ channel: 'agoda' }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('hotelIdentifier')
    })

    it('successfully processes inbound booking webhook', async () => {
      vi.mocked(processOtaInboundWebhook).mockResolvedValueOnce({
        success: true,
        action: 'BOOKING_NEW',
        bookingCode: 'OTA-AGO-TEST123',
        bookingId: 'b-1',
      })

      const req = new NextRequest('http://localhost/api/webhooks/channels/agoda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ota-signature': 'replace-me-mock-signature',
        },
        body: JSON.stringify({
          action: 'BOOKING_NEW',
          hotelIdentifier: 'AGODA-101',
          channelBookingId: 'AGO-888',
          channelRoomId: 'AGODA_R1',
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-03',
          guestName: 'Jane Smith',
          totalAmount: 2000000,
        }),
      })

      const res = await handleWebhook(req, { params: Promise.resolve({ channel: 'agoda' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.bookingCode).toBe('OTA-AGO-TEST123')
    })
  })

  describe('POST /api/properties/[id]/channels/sync', () => {
    it('requires authentication and edit permissions', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)
      const req = new NextRequest('http://localhost/api/properties/prop-1/channels/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const res = await handleManualSync(req, { params: Promise.resolve({ id: 'prop-1' }) })
      expect(res.status).toBe(401)
    })

    it('triggers sync successfully when permitted', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'prop-1' } as any)
      vi.mocked(syncRoomAvailabilityToChannels).mockResolvedValueOnce({
        syncedChannels: 2,
        syncedRooms: 4,
        success: true,
        logs: [],
      })

      const req = new NextRequest('http://localhost/api/properties/prop-1/channels/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const res = await handleManualSync(req, { params: Promise.resolve({ id: 'prop-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.syncedChannels).toBe(2)
    })
  })

  describe('GET /api/properties/[id]/channels/logs', () => {
    it('returns formatted sync logs', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'prop-1' } as any)
      vi.mocked(prisma.channelSyncLog.findMany).mockResolvedValueOnce([
        {
          id: 'log-1',
          channelAccount: { channel: 'AGODA', hotelIdentifier: 'AGODA-101' },
          direction: 'OUTBOUND_AVAILABILITY',
          status: 'SUCCESS',
          payload: { count: 30 },
          response: { ack: 'OK' },
          errorMessage: null,
          createdAt: new Date('2026-11-07T00:00:00Z'),
        },
      ] as any)

      const req = new NextRequest('http://localhost/api/properties/prop-1/channels/logs')
      const res = await handleGetLogs(req, { params: Promise.resolve({ id: 'prop-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.logs).toHaveLength(1)
      expect(data.data.logs[0].channel).toBe('AGODA')
    })
  })
})
