import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { prisma } from '@/lib/db'
import { OtaChannel, ChannelSyncDirection, ChannelSyncStatus } from '@prisma/client'

/**
 * GET /api/properties/[id]/channels/logs
 * Fetches recent sync logs (inbound bookings, cancellations, outbound inventory syncs).
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { id: propertyId } = await props.params

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...accessibleProperties(session.user.id) },
    select: { id: true },
  })
  if (!property) {
    return NextResponse.json({ error: 'Không tìm thấy cơ sở hoặc bạn không có quyền' }, { status: 404 })
  }

  const searchParams = request.nextUrl.searchParams
  const channelFilter = searchParams.get('channel') as OtaChannel | null
  const directionFilter = searchParams.get('direction') as ChannelSyncDirection | null
  const statusFilter = searchParams.get('status') as ChannelSyncStatus | null
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30))

  try {
    const logs = await prisma.channelSyncLog.findMany({
      where: {
        channelAccount: {
          propertyId,
          ...(channelFilter ? { channel: channelFilter } : {}),
        },
        ...(directionFilter ? { direction: directionFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        channelAccount: {
          select: {
            channel: true,
            hotelIdentifier: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      channel: log.channelAccount.channel,
      hotelIdentifier: log.channelAccount.hotelIdentifier,
      direction: log.direction,
      status: log.status,
      payload: log.payload,
      response: log.response,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        total: formattedLogs.length,
      },
    })
  } catch (err: any) {
    console.error('[OTA Logs] Fetch error:', err)
    return NextResponse.json({ error: 'Không thể tải nhật ký đồng bộ OTA' }, { status: 500 })
  }
}
