import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { syncIcalFeed } from '@/lib/ota/ical-sync'
import { OtaChannel } from '@/lib/ota/types'

/**
 * GET /api/properties/[id]/channels/ical
 * Lists all iCal feeds for this property, along with active room types.
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

    const [feeds, roomTypes] = await Promise.all([
      prisma.icalSyncFeed.findMany({
        where: { propertyId: params.id },
        include: {
          roomType: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.roomType.findMany({
        where: { propertyId: params.id, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        feeds,
        roomTypes,
      },
    })
  } catch (error) {
    console.error('[iCal Feeds List Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể tải danh sách liên kết iCal' }, { status: 500 })
  }
}

/**
 * POST /api/properties/[id]/channels/ical
 * Creates a new iCal feed for a room type.
 */
export async function POST(
  request: NextRequest,
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

    const body = await request.json()
    const { roomTypeId, name, channel = 'AIRBNB', importUrl } = body

    if (!roomTypeId || typeof roomTypeId !== 'string') {
      return NextResponse.json({ success: false, error: 'Loại phòng không hợp lệ' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Tên liên kết không được để trống' }, { status: 400 })
    }

    // Verify roomType belongs to property
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId: params.id, isActive: true },
      select: { id: true },
    })
    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Loại phòng không thuộc cơ sở này' }, { status: 400 })
    }

    // Validate importUrl if provided
    let cleanImportUrl: string | null = null
    if (importUrl && typeof importUrl === 'string' && importUrl.trim()) {
      cleanImportUrl = importUrl.trim()
      if (!cleanImportUrl.startsWith('http://') && !cleanImportUrl.startsWith('https://') && !cleanImportUrl.startsWith('webcal://')) {
        return NextResponse.json({ success: false, error: 'URL nhập lịch không hợp lệ' }, { status: 400 })
      }
      if (cleanImportUrl.startsWith('webcal://')) {
        cleanImportUrl = cleanImportUrl.replace(/^webcal:\/\//i, 'https://')
      }
    }

    // Validate channel
    const validChannels: OtaChannel[] = ['AIRBNB', 'BOOKING_COM', 'AGODA', 'TRAVELOKA', 'EXPEDIA']
    const assignedChannel = validChannels.includes(channel) ? channel : 'AIRBNB'

    const feed = await prisma.icalSyncFeed.create({
      data: {
        propertyId: params.id,
        roomTypeId,
        name: name.trim(),
        channel: assignedChannel,
        importUrl: cleanImportUrl,
      },
      include: {
        roomType: { select: { id: true, name: true } },
      },
    })

    // If importUrl is provided, trigger immediate first sync in the background
    if (cleanImportUrl) {
      syncIcalFeed(feed.id).catch((err) => {
        console.error('[iCal initial sync error]:', err)
      })
    }

    return NextResponse.json({
      success: true,
      data: feed,
    })
  } catch (error) {
    console.error('[iCal Feed Create Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể tạo liên kết iCal' }, { status: 500 })
  }
}
