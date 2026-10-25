import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { ACTIVE_BOOKING_STATUSES } from '@/lib/bookings/occupancy'
import { RoomError, countRooms, normalizeRoomNumber, peakTaken } from '@/lib/bookings/rooms'
import { invalidatePublicSite } from '@/lib/public-site/site'

type Props = { params: Promise<{ id: string }> }
type Tx = Prisma.TransactionClient

/** The room with the workspace it belongs to; null when there is none. */
function roomOf(id: string) {
  return prisma.room.findUnique({
    where: { id },
    select: { id: true, number: true, propertyId: true, roomTypeId: true, isActive: true, property: { select: { workspaceId: true } } },
  })
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy phòng' }, { status: 404 })

/** A stay in this room that has not ended (a split stay: its part in it): it must move first. */
async function currentStay(tx: Tx, roomId: string) {
  const now = new Date()
  const active = { status: { in: [...ACTIVE_BOOKING_STATUSES] } }
  const [whole, part] = await Promise.all([
    tx.bookingItem.findFirst({
      where: { roomId, booking: { ...active, checkOutDate: { gt: now }, roomSegments: { none: {} } } },
      select: { booking: { select: { bookingCode: true } } },
    }),
    tx.bookingRoomSegment.findFirst({ where: { roomId, toDate: { gt: now }, booking: active }, select: { booking: { select: { bookingCode: true } } } }),
  ])
  return whole ?? part
}

/** After a room stops counting: the type's inventory, which must still hold every night sold. */
async function checkInventory(tx: Tx, roomTypeId: string) {
  const { all, active } = await countRooms(tx, roomTypeId)
  if (all === 0) return null
  const peak = await peakTaken(tx, roomTypeId, new Date())
  if (active < peak) throw new RoomError(`Hạng phòng này đã bán tới ${peak} phòng trong một đêm sắp tới: cần ít nhất ${peak} phòng đang dùng`)
  return active
}

const updateSchema = z.object({
  number: z.string().trim().min(1).max(20).optional(),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
  isActive: z.boolean().optional(),
})

/** PATCH { number?, floor?, isActive? } — rename, change floor, stop or resume using a room. */
export async function PATCH(request: NextRequest, props: Props) {
  const { id } = await props.params
  const room = await roomOf(id)
  if (!room) return NOT_FOUND()
  // Owner, admins and managers change the hotel's rooms.
  const access = await requireWorkspaceRole(room.property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
  if (!access.ok) return access.response
  const userId = access.userId

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Thông tin phòng chưa đúng' }, { status: 400 })
  const number = parsed.data.number ? normalizeRoomNumber(parsed.data.number) : undefined

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM room_types WHERE id = ${room.roomTypeId} FOR UPDATE`
      if (number && number !== room.number) {
        const clash = await tx.room.findFirst({ where: { propertyId: room.propertyId, number, id: { not: room.id } }, select: { id: true } })
        if (clash) throw new RoomError(`Khách sạn đã có phòng ${number}`)
      }
      if (parsed.data.isActive === false && room.isActive) {
        const stay = await currentStay(tx, room.id)
        if (stay) throw new RoomError(`Phòng ${room.number} đang có đơn ${stay.booking.bookingCode}: đổi phòng cho đơn đó trước`)
      }
      const saved = await tx.room.update({
        where: { id: room.id },
        data: { ...(number && { number }), ...(parsed.data.floor !== undefined && { floor: parsed.data.floor }), ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }) },
      })
      // Stays keep the room's number as text too (slips, emails).
      if (number && number !== room.number) {
        await tx.bookingItem.updateMany({ where: { roomId: room.id }, data: { roomNumber: number } })
        await tx.bookingRoomSegment.updateMany({ where: { roomId: room.id }, data: { roomNumber: number } })
      }
      const active = await checkInventory(tx, room.roomTypeId)
      if (active !== null) await tx.roomType.update({ where: { id: room.roomTypeId }, data: { totalRooms: active } })
      await tx.activityLog.create({
        data: { userId, propertyId: room.propertyId, action: 'UPDATE', entityType: 'ROOM', entityId: room.id, changes: { ...parsed.data, ...(number && { number }) } },
      })
      return saved
    })
    invalidatePublicSite(room.propertyId)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof RoomError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    console.error('Update room error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật phòng' }, { status: 500 })
  }
}

/** DELETE — removes a room no current stay is in; past stays keep its number as text. */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const room = await roomOf(id)
  if (!room) return NOT_FOUND()
  // Owner, admins and managers change the hotel's rooms.
  const access = await requireWorkspaceRole(room.property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
  if (!access.ok) return access.response
  const userId = access.userId

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM room_types WHERE id = ${room.roomTypeId} FOR UPDATE`
      const stay = await currentStay(tx, room.id)
      if (stay) throw new RoomError(`Phòng ${room.number} đang có đơn ${stay.booking.bookingCode}: đổi phòng cho đơn đó trước`)
      await tx.room.delete({ where: { id: room.id } })
      const active = await checkInventory(tx, room.roomTypeId)
      if (active !== null) await tx.roomType.update({ where: { id: room.roomTypeId }, data: { totalRooms: active } })
      await tx.activityLog.create({
        data: { userId, propertyId: room.propertyId, action: 'DELETE', entityType: 'ROOM', entityId: room.id, metadata: { number: room.number } },
      })
    })
    invalidatePublicSite(room.propertyId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RoomError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    console.error('Delete room error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xoá phòng' }, { status: 500 })
  }
}
