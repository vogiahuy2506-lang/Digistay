import type { OtaChannel, ChannelSyncStatus, ChannelSyncDirection } from '@prisma/client'

export type { OtaChannel, ChannelSyncStatus, ChannelSyncDirection }

export interface ChannelProviderMeta {
  channel: OtaChannel
  name: string
  shortDescription: string
  logoUrl?: string
  accentColor: string
  badgeColor: string
  hotelIdLabel: string
  hotelIdPlaceholder: string
  portalUrl: string
  helpDocUrl: string
  defaultCommissionRate: number // e.g. 15%
}

export const OTA_CHANNELS_META: Record<OtaChannel, ChannelProviderMeta> = {
  AGODA: {
    channel: 'AGODA',
    name: 'Agoda',
    shortDescription: 'Kênh phân phối khách sạn & resort hàng đầu châu Á - Thái Bình Dương (YCS API).',
    accentColor: '#003580',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    hotelIdLabel: 'Agoda Hotel ID (Mã khách sạn trên YCS)',
    hotelIdPlaceholder: 'Ví dụ: 1234567',
    portalUrl: 'https://ycs.agoda.com',
    helpDocUrl: 'https://ycs.agoda.com/help',
    defaultCommissionRate: 15,
  },
  BOOKING_COM: {
    channel: 'BOOKING_COM',
    name: 'Booking.com',
    shortDescription: 'Mạng lưới khách sạn & du lịch toàn cầu lớn nhất thế giới (Connectivity API).',
    accentColor: '#003580',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    hotelIdLabel: 'Booking.com Legal Entity / Hotel ID',
    hotelIdPlaceholder: 'Ví dụ: 9876543',
    portalUrl: 'https://admin.booking.com',
    helpDocUrl: 'https://partner.booking.com/help',
    defaultCommissionRate: 15,
  },
  AIRBNB: {
    channel: 'AIRBNB',
    name: 'Airbnb',
    shortDescription: 'Kênh đặt phòng homestay, villa nghỉ dưỡng và căn hộ du lịch toàn cầu.',
    accentColor: '#FF5A5F',
    badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    hotelIdLabel: 'Airbnb Host ID / Listing ID',
    hotelIdPlaceholder: 'Ví dụ: 45678912',
    portalUrl: 'https://www.airbnb.com/hosting',
    helpDocUrl: 'https://www.airbnb.com/help',
    defaultCommissionRate: 14,
  },
  TRAVELOKA: {
    channel: 'TRAVELOKA',
    name: 'Traveloka',
    shortDescription: 'Siêu ứng dụng du lịch hàng đầu Đông Nam Á (TERA Portal API).',
    accentColor: '#1BA0E2',
    badgeColor: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
    hotelIdLabel: 'Traveloka Hotel Code (TERA ID)',
    hotelIdPlaceholder: 'Ví dụ: TVLK-5566',
    portalUrl: 'https://tera.traveloka.com',
    helpDocUrl: 'https://tera.traveloka.com/help',
    defaultCommissionRate: 15,
  },
  EXPEDIA: {
    channel: 'EXPEDIA',
    name: 'Expedia Partner Central',
    shortDescription: 'Tập đoàn du lịch toàn cầu (Expedia, Hotels.com, Vrbo).',
    accentColor: '#00256C',
    badgeColor: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    hotelIdLabel: 'Expedia Property ID (Expedia ID)',
    hotelIdPlaceholder: 'Ví dụ: EXP-102938',
    portalUrl: 'https://www.expediapartnercentral.com',
    helpDocUrl: 'https://welcome.expediagroup.com',
    defaultCommissionRate: 18,
  },
}

export interface DecryptedChannelConfig {
  apiKey: string
  apiSecret?: string
  webhookSecret: string
  rateMultiplierDefault?: number
  autoAcceptBookings?: boolean
}

export interface ChannelRoomMappingData {
  id?: string
  roomTypeId: string
  roomTypeName?: string
  roomTypeSlug?: string
  channelRoomId: string
  channelRoomName?: string
  channelRatePlanId?: string
  rateMultiplier: number
  isSyncEnabled: boolean
}

export interface ChannelAccountSummary {
  channel: OtaChannel
  name: string
  hotelIdentifier: string | null
  isActive: boolean
  lastSyncedAt: string | null
  lastError: string | null
  mappedRoomsCount: number
  totalPropertyRoomsCount: number
  webhookUrl: string
  maskedApiKey?: string
}

export interface ChannelAccountDetail extends ChannelAccountSummary {
  webhookSecret: string
  rateMultiplierDefault: number
  autoAcceptBookings: boolean
  mappings: ChannelRoomMappingData[]
}
