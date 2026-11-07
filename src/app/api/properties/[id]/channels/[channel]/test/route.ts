import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { testOtaChannelConnection } from '@/lib/ota/channel-manager'
import { OtaChannel } from '@/lib/ota/types'

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

const testConnectionSchema = z.object({
  hotelIdentifier: z.string().trim().min(1, 'Mã khách sạn không được để trống'),
  apiKey: z.string().optional(),
})

/**
 * POST /api/properties/[id]/channels/[channel]/test
 * Validates connection with the OTA provider.
 */
export async function POST(
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
      select: { id: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền kiểm tra kết nối cơ sở này' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = testConnectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' },
        { status: 400 }
      )
    }

    const result = await testOtaChannelConnection(
      params.id,
      channel,
      parsed.data.hotelIdentifier,
      parsed.data.apiKey
    )

    return NextResponse.json({
      success: result.ok,
      data: result,
      message: result.message,
    }, { status: result.ok ? 200 : 400 })
  } catch (error) {
    console.error('[API Channel Test POST Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể kiểm tra kết nối với kênh lúc này' }, { status: 500 })
  }
}

