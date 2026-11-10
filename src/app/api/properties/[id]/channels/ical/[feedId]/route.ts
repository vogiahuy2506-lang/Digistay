import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { syncIcalFeed } from '@/lib/ota/ical-sync'

/**
 * PUT /api/properties/[id]/channels/ical/[feedId]
 * Updates feed details (name, importUrl, isActive).
 */
export async function PUT(
  request: NextRequest,
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

    const body = await request.json()
    const { name, importUrl, isActive } = body

    const updateData: any = {}
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim()
    }

    if (importUrl !== undefined) {
      if (typeof importUrl === 'string' && importUrl.trim()) {
        let clean = importUrl.trim()
        if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('webcal://')) {
          return NextResponse.json({ success: false, error: 'URL nhập lịch không hợp lệ' }, { status: 400 })
        }
        if (clean.startsWith('webcal://')) {
          clean = clean.replace(/^webcal:\/\//i, 'https://')
        }
        updateData.importUrl = clean
      } else {
        updateData.importUrl = null
      }
    }

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive
    }

    const updated = await prisma.icalSyncFeed.update({
      where: { id: params.feedId },
      data: updateData,
      include: {
        roomType: { select: { id: true, name: true } },
      },
    })

    if (updateData.importUrl && updateData.importUrl !== feed.importUrl) {
      syncIcalFeed(updated.id).catch((err) => {
        console.error('[iCal updated sync error]:', err)
      })
    }

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('[iCal Feed Update Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể cập nhật liên kết iCal' }, { status: 500 })
  }
}

/**
 * DELETE /api/properties/[id]/channels/ical/[feedId]
 * Deletes feed and its associated blocked RoomLocks.
 */
export async function DELETE(
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

    // Delete associated room locks and feed in transaction
    await prisma.$transaction([
      prisma.roomLock.deleteMany({
        where: {
          propertyId: params.id,
          sessionId: { startsWith: `ical-${feed.id}-` },
        },
      }),
      prisma.icalSyncFeed.delete({
        where: { id: params.feedId },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Đã xóa liên kết iCal và giải phóng các phòng bị khóa bởi liên kết này',
    })
  } catch (error) {
    console.error('[iCal Feed Delete Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể xóa liên kết iCal' }, { status: 500 })
  }
}

