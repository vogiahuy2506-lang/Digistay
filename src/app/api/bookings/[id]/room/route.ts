import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { checkPropertyAccess } from '@/lib/auth/access'
import { RoomError, assignRoomTx } from '@/lib/bookings/rooms'
import { lockedResponseForProperty } from '@/lib/billing/guard'

const day = z.string().max(10)
const schema = z.object({ roomId: z.string().min(1).nullable(), fromDate: day.optional(), toDate: day.optional() })

/**
 * POST /api/bookings/[id]/room { roomId | null, fromDate?, toDate? } — puts
 * the stay in one of the hotel's rooms, moves it to another (another type
 * too, when that type has a room free every night), or takes it out
 * (src/lib/bookings/rooms.ts). With fromDate (yyyy-mm-dd, Vietnam), only the
 * nights from then (to toDate, default check-out) move: a mid-stay room
 * change. Front desk and up; logged.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const sess = await requireSession()
  if (!sess.ok) return sess.response
  const userId = sess.session.user.id
  const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true, propertyId: true, bookingCode: true } })
  // Outsiders get the same 404 as a missing booking; members without the permission 403.
  if (!booking) return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
  const access = await checkPropertyAccess(userId, booking.propertyId, 'bookings_edit', 'Không tìm thấy đơn đặt phòng')
  if (!access.ok) return access.response
  const locked = await lockedResponseForProperty(booking.propertyId)
  if (locked) return locked

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Chọn một phòng' }, { status: 400 })

  try {
    const moved = await prisma.$transaction(async (tx) => {
      const { roomId, fromDate, toDate } = parsed.data
      const result = await assignRoomTx(tx, { bookingId: id, roomId, fromDate, toDate })
      await tx.activityLog.create({
        data: {
          userId,
          propertyId: booking.propertyId,
          action: 'ROOM_ASSIGNED',
          entityType: 'BOOKING',
          entityId: id,
          changes: { from: result.from, to: result.to, roomTypeChanged: result.roomTypeChanged, ...(fromDate && { fromDate }), ...(toDate && { toDate }) },
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
