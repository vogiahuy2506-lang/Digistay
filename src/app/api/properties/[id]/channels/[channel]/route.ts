import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import {
  getPropertyChannelDetail,
  savePropertyChannelAccount,
  disconnectPropertyChannelAccount,
} from '@/lib/ota/channel-manager'
import { OtaChannel, OTA_CHANNELS_META } from '@/lib/ota/types'

const validChannels: [OtaChannel, ...OtaChannel[]] = [
  'AGODA',
  'BOOKING_COM',
  'AIRBNB',
  'TRAVELOKA',
  'EXPEDIA',
]

function parseChannelParam(param: string): OtaChannel | null {
  const upper = param.toUpperCase().replace(/-/g, '_')
  return (validChannels as string[]).includes(upper) ? (upper as OtaChannel) : null
}

const saveChannelSchema = z.object({
  hotelIdentifier: z.string().trim().min(1, 'Mã khách sạn (Hotel ID) không được để trống'),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  rateMultiplierDefault: z.number().min(0.5).max(3.0).optional().default(1.0),
  autoAcceptBookings: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(false),
  mappings: z
    .array(
      z.object({
        roomTypeId: z.string().min(1),
        channelRoomId: z.string().default(''),
        channelRoomName: z.string().optional(),
        channelRatePlanId: z.string().optional(),
        rateMultiplier: z.number().min(0.5).max(3.0).optional().default(1.0),
        isSyncEnabled: z.boolean().optional().default(true),
      })
    )
    .optional(),
})

/**
 * GET /api/properties/[id]/channels/[channel]
 * Retrieves detailed configuration and room mapping table for a single OTA channel.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string; channel: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const channel = parseChannelParam(params.channel)
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Kênh phân phối không hợp lệ' }, { status: 400 })
    }

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true, name: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở hoặc bạn không có quyền' }, { status: 404 })
    }

    const detail = await getPropertyChannelDetail(params.id, channel)

    return NextResponse.json({
      success: true,
      data: {
        propertyId: params.id,
        propertyName: property.name,
        meta: OTA_CHANNELS_META[channel],
        channel: detail,
      },
    })
  } catch (error) {
    console.error('[API Channel Detail GET Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể tải thông tin kênh OTA' }, { status: 500 })
  }
}

/**
 * PUT /api/properties/[id]/channels/[channel]
 * Encrypts credentials and updates channel account and room mappings.
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; channel: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const channel = parseChannelParam(params.channel)
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Kênh phân phối không hợp lệ' }, { status: 400 })
    }

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id, 'property_edit') },
      select: { id: true, name: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền chỉnh sửa kênh cơ sở này' }, { status: 403 })
    }

    const locked = await lockedResponseForProperty(params.id)
    if (locked) return locked

    const body = await request.json().catch(() => null)
    const parsed = saveChannelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' },
        { status: 400 }
      )
    }

    const updated = await savePropertyChannelAccount(params.id, channel, parsed.data)

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Đã cập nhật cấu hình kênh ${OTA_CHANNELS_META[channel].name} thành công`,
    })
  } catch (error) {
    console.error('[API Channel Detail PUT Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể lưu cấu hình kênh OTA' }, { status: 500 })
  }
}

/**
 * DELETE /api/properties/[id]/channels/[channel]
 * Disconnects the channel account and removes room mappings.
 */
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string; channel: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const channel = parseChannelParam(params.channel)
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Kênh phân phối không hợp lệ' }, { status: 400 })
    }

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id, 'property_edit') },
      select: { id: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền ngắt kết nối kênh này' }, { status: 403 })
    }

    const locked = await lockedResponseForProperty(params.id)
    if (locked) return locked

    const disconnected = await disconnectPropertyChannelAccount(params.id, channel)

    return NextResponse.json({
      success: true,
      data: { disconnected },
      message: `Đã ngắt kết nối kênh ${OTA_CHANNELS_META[channel].name}`,
    })
  } catch (error) {
    console.error('[API Channel Detail DELETE Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể ngắt kết nối kênh OTA' }, { status: 500 })
  }
}
