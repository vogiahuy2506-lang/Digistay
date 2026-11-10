import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { syncIcalFeed } from '@/lib/ota/ical-sync'

/**
 * POST /api/properties/[id]/channels/ical/[feedId]/sync
 * Triggers on-demand synchronization for a specific feed.
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string; feedId: string }> }
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

    const feed = await prisma.icalSyncFeed.findFirst({
      where: { id: params.feedId, propertyId: params.id },
    })
    if (!feed) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy liên kết iCal' }, { status: 404 })
    }

    const result = await syncIcalFeed(feed.id)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Lỗi đồng bộ lịch iCal',
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        eventsCount: result.eventsCount,
      },
    })
  } catch (error) {
    console.error('[iCal Manual Sync Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể đồng bộ lịch lúc này' }, { status: 500 })
  }
}

