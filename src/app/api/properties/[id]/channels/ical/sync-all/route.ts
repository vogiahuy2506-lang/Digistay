import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { syncAllActiveIcalFeeds } from '@/lib/ota/ical-sync'

/**
 * POST /api/properties/[id]/channels/ical/sync-all
 * Triggers immediate sync for all active iCal feeds of a property.
 */
export async function POST(
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
      select: { id: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở hoặc bạn không có quyền' }, { status: 404 })
    }

    const summary = await syncAllActiveIcalFeeds(params.id)
    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('[iCal Sync All Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể đồng bộ lịch OTA' }, { status: 500 })
  }
}
