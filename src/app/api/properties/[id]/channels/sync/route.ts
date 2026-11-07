import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { prisma } from '@/lib/db'
import { syncRoomAvailabilityToChannels } from '@/lib/ota/sync-engine'

/**
 * POST /api/properties/[id]/channels/sync
 * Manually triggers inventory & rate sync from Digistay out to all active OTA channels.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { id: propertyId } = await props.params

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...accessibleProperties(session.user.id, 'property_edit') },
    select: { id: true },
  })
  if (!property) {
    return NextResponse.json({ error: 'Bạn không có quyền đồng bộ kênh cơ sở này' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const roomTypeId = body.roomTypeId ? String(body.roomTypeId) : undefined
  const startDate = body.startDate ? new Date(body.startDate) : undefined
  const endDate = body.endDate ? new Date(body.endDate) : undefined

  try {
    const result = await syncRoomAvailabilityToChannels(propertyId, {
      roomTypeId,
      startDate,
      endDate,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Đã đồng bộ tồn kho và giá sang các kênh OTA thành công',
    })
  } catch (err: any) {
    console.error('[OTA Sync] Manual sync error:', err)
    return NextResponse.json(
      { error: err.message || 'Không thể đồng bộ sang kênh OTA lúc này' },
      { status: 500 }
    )
  }
}
