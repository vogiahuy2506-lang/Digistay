import { randomBytes } from 'crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateWebhookSecret,
  getPropertyChannelsSummary,
  getPropertyChannelDetail,
  savePropertyChannelAccount,
  testOtaChannelConnection,
  disconnectPropertyChannelAccount,
} from './channel-manager'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    channelAccount: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    channelRoomMapping: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    roomType: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(prisma)),
  },
}))

// Mock encryption keys environment variable
beforeEach(() => {
  const validKey = randomBytes(32).toString('base64')
  process.env.DATA_ENCRYPTION_KEYS = `test-key-id:${validKey}`
  vi.clearAllMocks()
})

describe('OTA Channel Manager Core (Task 55)', () => {
  it('generates secure random webhook secrets prefixed with whsec_', () => {
    const s1 = generateWebhookSecret()
    const s2 = generateWebhookSecret()
    expect(s1).toMatch(/^whsec_[a-f0-9]{48}$/)
    expect(s2).toMatch(/^whsec_[a-f0-9]{48}$/)
    expect(s1).not.toBe(s2)
  })

  it('lists summary of all supported OTA channels for a property', async () => {
    vi.mocked(prisma.channelAccount.findMany).mockResolvedValueOnce([
      {
        id: 'acc-1',
        propertyId: 'prop-1',
        channel: 'AGODA',
        hotelIdentifier: 'AGODA-1234',
        encryptedConfig: '',
        isActive: true,
        lastSyncedAt: new Date('2026-11-06T10:00:00Z'),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { mappings: 2 },
      } as any,
    ])
    vi.mocked(prisma.roomType.count).mockResolvedValueOnce(3)

    const summary = await getPropertyChannelsSummary('prop-1')
    expect(summary).toHaveLength(5)

    const agoda = summary.find((c) => c.channel === 'AGODA')
    expect(agoda).toBeDefined()
    expect(agoda?.isActive).toBe(true)
    expect(agoda?.hotelIdentifier).toBe('AGODA-1234')
    expect(agoda?.mappedRoomsCount).toBe(2)
    expect(agoda?.totalPropertyRoomsCount).toBe(3)
    expect(agoda?.webhookUrl).toContain('/api/webhooks/channels/agoda?propertyId=prop-1')

    const booking = summary.find((c) => c.channel === 'BOOKING_COM')
    expect(booking).toBeDefined()
    expect(booking?.isActive).toBe(false)
    expect(booking?.hotelIdentifier).toBeNull()
  })

  it('gets channel detail merging existing mappings with unmapped room types', async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValueOnce({
      id: 'acc-1',
      propertyId: 'prop-1',
      channel: 'BOOKING_COM',
      hotelIdentifier: 'BK-999',
      encryptedConfig: '',
      isActive: true,
      lastSyncedAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      mappings: [
        {
          id: 'map-1',
          channelAccountId: 'acc-1',
          roomTypeId: 'rt-1',
          channelRoomId: 'BK_ROOM_DELUXE',
          channelRoomName: 'Deluxe Ocean',
          channelRatePlanId: 'STANDARD',
          rateMultiplier: 1.15,
          isSyncEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          roomType: { id: 'rt-1', name: 'Deluxe', slug: 'deluxe' },
        },
      ],
    } as any)

    vi.mocked(prisma.roomType.findMany).mockResolvedValueOnce([
      { id: 'rt-1', name: 'Deluxe', slug: 'deluxe' },
      { id: 'rt-2', name: 'Suite', slug: 'suite' },
    ] as any)

    const detail = await getPropertyChannelDetail('prop-1', 'BOOKING_COM')
    expect(detail.channel).toBe('BOOKING_COM')
    expect(detail.hotelIdentifier).toBe('BK-999')
    expect(detail.mappings).toHaveLength(2)

    const mapped = detail.mappings.find((m) => m.roomTypeId === 'rt-1')
    expect(mapped?.channelRoomId).toBe('BK_ROOM_DELUXE')
    expect(mapped?.rateMultiplier).toBe(1.15)

    const unmapped = detail.mappings.find((m) => m.roomTypeId === 'rt-2')
    expect(unmapped?.channelRoomId).toBe('')
    expect(unmapped?.rateMultiplier).toBe(1.0)
  })

  it('encrypts credentials and saves channel account and mappings with interactive transaction', async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.channelAccount.upsert).mockResolvedValueOnce({
      id: 'acc-new',
      propertyId: 'prop-1',
      channel: 'AGODA',
      hotelIdentifier: 'AGODA-555',
      encryptedConfig: 'encrypted-str',
      isActive: true,
      lastSyncedAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    // Second findUnique call for getPropertyChannelDetail return
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValueOnce({
      id: 'acc-new',
      propertyId: 'prop-1',
      channel: 'AGODA',
      hotelIdentifier: 'AGODA-555',
      encryptedConfig: '',
      isActive: true,
      lastSyncedAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      mappings: [],
    } as any)
    vi.mocked(prisma.roomType.findMany).mockResolvedValueOnce([])

    const saved = await savePropertyChannelAccount('prop-1', 'AGODA', {
      hotelIdentifier: 'AGODA-555',
      apiKey: 'api-secret-key-12345',
      rateMultiplierDefault: 1.1,
      isActive: true,
      mappings: [
        {
          roomTypeId: 'rt-1',
          channelRoomId: 'AGODA_R1',
          channelRoomName: 'Agoda Superior',
          rateMultiplier: 1.1,
          isSyncEnabled: true,
        },
        {
          roomTypeId: 'rt-2',
          channelRoomId: '', // should delete mapping
        },
      ],
    })

    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.channelAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { propertyId_channel: { propertyId: 'prop-1', channel: 'AGODA' } },
        create: expect.objectContaining({
          hotelIdentifier: 'AGODA-555',
          isActive: true,
          encryptedConfig: expect.stringMatching(/^v1\.test-key-id\./),
        }),
      })
    )
    expect(prisma.channelRoomMapping.upsert).toHaveBeenCalledTimes(1)
    expect(prisma.channelRoomMapping.deleteMany).toHaveBeenCalledTimes(1)
    expect(saved.hotelIdentifier).toBe('AGODA-555')
  })

  it('tests OTA channel connection and validates hotel identifier and API key', async () => {
    // Missing hotel identifier
    const resNoId = await testOtaChannelConnection('prop-1', 'AGODA', '')
    expect(resNoId.ok).toBe(false)
    expect(resNoId.message).toContain('Mã khách sạn')

    // Missing key and no saved key
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValueOnce(null)
    const resNoKey = await testOtaChannelConnection('prop-1', 'AGODA', 'AGODA-123')
    expect(resNoKey.ok).toBe(false)
    expect(resNoKey.message).toContain('API Key')

    // Valid credentials
    const resOk = await testOtaChannelConnection('prop-1', 'AGODA', 'AGODA-123', 'agoda-valid-api-key')
    expect(resOk.ok).toBe(true)
    expect(resOk.message).toContain('thành công')
    expect(resOk.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('disconnects channel account and returns true if existed', async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValueOnce({ id: 'acc-1' } as any)
    vi.mocked(prisma.channelAccount.delete).mockResolvedValueOnce({ id: 'acc-1' } as any)

    const res = await disconnectPropertyChannelAccount('prop-1', 'AGODA')
    expect(res).toBe(true)
    expect(prisma.channelAccount.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } })

    // When account does not exist
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValueOnce(null)
    const resNone = await disconnectPropertyChannelAccount('prop-1', 'AIRBNB')
    expect(resNone).toBe(false)
  })
})
