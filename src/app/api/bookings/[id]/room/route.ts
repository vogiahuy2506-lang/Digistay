import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { RoomError, assignRoomTx } from '@/lib/bookings/rooms'

const schema = z.object({ roomId: z.string().min(1).nullable() })

/**
 * POST /api/bookings/[id]/room { roomId | null } — puts the stay in one of
 * the hotel's rooms, moves it to another (another type too, when that type
 * has a room free every night), or takes it out (src/lib/bookings/rooms.ts).
 * Front desk and up; logged.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true, propertyId: true, bookingCode: true, property: { select: { workspaceId: true } } } })
  if (!booking) return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
  const access = await requireWorkspaceRole(booking.property.workspaceId, WorkspaceRoles.STAFF_AND_UP)
  if (!access.ok) return access.response

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Chọn một phòng' }, { status: 400 })

  try {
    const moved = await prisma.$transaction(async (tx) => {
      const result = await assignRoomTx(tx, { bookingId: id, roomId: parsed.data.roomId })
      await tx.activityLog.create({
        data: {
          userId: access.userId,
          propertyId: booking.propertyId,
          action: 'ROOM_ASSIGNED',
          entityType: 'BOOKING',
          entityId: id,
          changes: { from: result.from, to: result.to, roomTypeChanged: result.roomTypeChanged },
          metadata: { bookingCode: booking.bookingCode },
        },
      })
      return result
    })
    return NextResponse.json({ success: true, data: moved })
  } catch (error) {
    if (error instanceof RoomError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    console.error('Assign room error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xếp phòng' }, { status: 500 })
  }
}
