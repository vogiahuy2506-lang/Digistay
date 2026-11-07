import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { getPropertyChannelsSummary } from '@/lib/ota/channel-manager'

/**
 * GET /api/properties/[id]/channels
 * Returns an overview of all 5 supported OTA channels for this property,
 * their connection status, mapped room counts, and unique webhook endpoints.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true, name: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở hoặc bạn không có quyền' }, { status: 404 })
    }

    const channels = await getPropertyChannelsSummary(params.id)

    return NextResponse.json({
      success: true,
      data: {
        propertyId: params.id,
        propertyName: property.name,
        channels,
      },
    })
  } catch (error) {
    console.error('[API Channels List Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể tải danh sách kênh OTA lúc này' }, { status: 500 })
  }
}
