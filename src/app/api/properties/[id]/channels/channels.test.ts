import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listChannels } from './route'
import { GET as getChannel, PUT as saveChannel, DELETE as disconnectChannel } from './[channel]/route'
import { POST as testConnection } from './[channel]/test/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as channelManager from '@/lib/ota/channel-manager'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    property: {
      findFirst: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
    memberProperty: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/billing/guard', () => ({
  lockedResponseForProperty: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/ota/channel-manager', () => ({
  getPropertyChannelsSummary: vi.fn(),
  getPropertyChannelDetail: vi.fn(),
  savePropertyChannelAccount: vi.fn(),
  testOtaChannelConnection: vi.fn(),
  disconnectPropertyChannelAccount: vi.fn(),
}))

const mockAuth = vi.mocked(auth)
const params = (id: string, channel?: string) => ({
  params: Promise.resolve({ id, channel: channel || '' }),
})

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OTA Channels API Routes (Task 55)', () => {
  describe('GET /api/properties/[id]/channels', () => {
    it('returns 401 when not logged in', async () => {
      mockAuth.mockResolvedValueOnce(null as any)
      const res = await listChannels(req('/api/properties/p1/channels', 'GET'), params('p1'))
      expect(res.status).toBe(401)
    })

    it('returns 404 when user has no access to property', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce(null)
      const res = await listChannels(req('/api/properties/p1/channels', 'GET'), params('p1'))
      expect(res.status).toBe(404)
    })

    it('returns channels summary list when authorized', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'p1', name: 'Digistay Da Nang' } as any)
      vi.mocked(channelManager.getPropertyChannelsSummary).mockResolvedValueOnce([
        { channel: 'AGODA', name: 'Agoda', isActive: true, mappedRoomsCount: 2, totalPropertyRoomsCount: 4, webhookUrl: 'http://wh' } as any,
      ])

      const res = await listChannels(req('/api/properties/p1/channels', 'GET'), params('p1'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.propertyName).toBe('Digistay Da Nang')
      expect(data.data.channels).toHaveLength(1)
    })
  })

  describe('GET /api/properties/[id]/channels/[channel]', () => {
    it('rejects invalid channel param with 400', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      const res = await getChannel(req('/api/properties/p1/channels/INVALID', 'GET'), params('p1', 'INVALID'))
      expect(res.status).toBe(400)
    })

    it('returns channel details and room mappings', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'p1', name: 'Digistay Da Nang' } as any)
      vi.mocked(channelManager.getPropertyChannelDetail).mockResolvedValueOnce({
        channel: 'BOOKING_COM',
        hotelIdentifier: 'BK-100',
        isActive: true,
        mappings: [],
      } as any)

      const res = await getChannel(req('/api/properties/p1/channels/booking_com', 'GET'), params('p1', 'booking_com'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data.channel.hotelIdentifier).toBe('BK-100')
      expect(data.data.meta.name).toBe('Booking.com')
    })
  })

  describe('PUT /api/properties/[id]/channels/[channel]', () => {
    it('validates request body and saves channel settings', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'p1', name: 'Digistay' } as any)
      vi.mocked(channelManager.savePropertyChannelAccount).mockResolvedValueOnce({
        channel: 'AGODA',
        hotelIdentifier: 'AGODA-200',
        isActive: true,
        mappings: [],
      } as any)

      const res = await saveChannel(
        req('/api/properties/p1/channels/agoda', 'PUT', {
          hotelIdentifier: 'AGODA-200',
          apiKey: 'agoda-key',
          isActive: true,
          mappings: [
            { roomTypeId: 'rt-1', channelRoomId: 'AG_DELUXE', rateMultiplier: 1.15 },
          ],
        }),
        params('p1', 'agoda')
      )

      expect(res.status).toBe(200)
      expect(channelManager.savePropertyChannelAccount).toHaveBeenCalledWith(
        'p1',
        'AGODA',
        expect.objectContaining({
          hotelIdentifier: 'AGODA-200',
          apiKey: 'agoda-key',
          isActive: true,
        })
      )
    })

    it('rejects empty hotel identifier', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'p1' } as any)

      const res = await saveChannel(
        req('/api/properties/p1/channels/agoda', 'PUT', {
          hotelIdentifier: '   ',
        }),
        params('p1', 'agoda')
      )
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/properties/[id]/channels/[channel]/test', () => {
    it('tests connection and returns test result status', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'p1' } as any)
      vi.mocked(channelManager.testOtaChannelConnection).mockResolvedValueOnce({
        ok: true,
        message: 'Connected',
        latencyMs: 120,
      })

      const res = await testConnection(
        req('/api/properties/p1/channels/agoda/test', 'POST', {
          hotelIdentifier: 'AGODA-100',
          apiKey: 'test-key',
        }),
        params('p1', 'agoda')
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data.ok).toBe(true)
    })
  })

  describe('DELETE /api/properties/[id]/channels/[channel]', () => {
    it('disconnects channel account', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as any)
      vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'p1' } as any)
      vi.mocked(channelManager.disconnectPropertyChannelAccount).mockResolvedValueOnce(true)

      const res = await disconnectChannel(
        req('/api/properties/p1/channels/agoda', 'DELETE'),
        params('p1', 'agoda')
      )
      expect(res.status).toBe(200)
      expect(channelManager.disconnectPropertyChannelAccount).toHaveBeenCalledWith('p1', 'AGODA')
    })
  })
})

