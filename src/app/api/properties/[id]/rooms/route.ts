import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { RoomError, countRooms, parseRoomNumbers, peakTaken } from '@/lib/bookings/rooms'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { planResponseForProperty } from '@/lib/billing/guard'

type Props = { params: Promise<{ id: string }> }

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

/** GET — the hotel's rooms by room type (src/lib/bookings/rooms.ts). Staff. */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.STAFF_AND_UP)
  if (!access.ok) return access.response

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      totalRooms: true,
      rooms: { orderBy: { number: 'asc' }, select: { id: true, number: true, floor: true, isActive: true } },
    },
  })
  return NextResponse.json({ success: true, data: roomTypes })
}

const createSchema = z.object({
  roomTypeId: z.string().min(1),
  numbers: z.string().trim().min(1, 'Nhập số phòng').max(2000),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
})

/**
 * POST { roomTypeId, numbers: "101-110, 201", floor? } — adds rooms to a
 * type. Its inventory becomes its active rooms, which must still hold every
 * future night already sold. Owner, admins and managers.
 */
export async function POST(request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
  if (!access.ok) return access.response

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  const numbers = parseRoomNumbers(parsed.data.numbers)
  if (!numbers) {
    return NextResponse.json({ success: false, error: 'Số phòng chưa đúng (ví dụ: 101-110, 201, 202; tối đa 200 phòng mỗi lần)' }, { status: 400 })
  }

  // The plan's number of rooms (src/lib/billing): the type's count becomes its active rooms plus these.
  const typeNow = await prisma.roomType.findFirst({
    where: { id: parsed.data.roomTypeId, propertyId: id },
    select: { id: true, isActive: true, totalRooms: true, planLockedAt: true },
  })
  if (typeNow) {
    const [all, active] = await Promise.all([
      prisma.room.count({ where: { roomTypeId: typeNow.id } }),
      prisma.room.count({ where: { roomTypeId: typeNow.id, isActive: true } }),
    ])
    const after = (all > 0 ? active : 0) + numbers.length
    const overPlan = await planResponseForProperty(id, 'rooms', typeNow.isActive && !typeNow.planLockedAt ? after - typeNow.totalRooms : 0)
    if (overPlan) return overPlan
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const roomType = await tx.roomType.findFirst({ where: { id: parsed.data.roomTypeId, propertyId: id }, select: { id: true, name: true } })
      if (!roomType) throw new RoomError('Không tìm thấy hạng phòng', 404)
      await tx.$queryRaw`SELECT id FROM room_types WHERE id = ${roomType.id} FOR UPDATE`

      const existing = await tx.room.findMany({ where: { propertyId: id, number: { in: numbers } }, select: { number: true } })
      if (existing.length) throw new RoomError(`Khách sạn đã có phòng ${existing.map((r) => r.number).join(', ')}`)
      await tx.room.createMany({
        data: numbers.map((number) => ({ propertyId: id, roomTypeId: roomType.id, number, floor: parsed.data.floor ?? null })),
      })

      const { active } = await countRooms(tx, roomType.id)
      const peak = await peakTaken(tx, roomType.id, new Date())
      if (active < peak) {
        throw new RoomError(`Hạng ${roomType.name} đã bán tới ${peak} phòng trong một đêm sắp tới: cần ít nhất ${peak} phòng đang dùng (hiện ${active})`)
      }
      await tx.roomType.update({ where: { id: roomType.id }, data: { totalRooms: active } })
      await tx.activityLog.create({
        data: {
          userId: access.userId,
          workspaceId,
          propertyId: id,
          action: 'CREATE',
          entityType: 'ROOM',
          entityId: roomType.id,
          metadata: { numbers, roomTypeName: roomType.name },
        },
      })
      return { created: numbers.length, totalRooms: active }
    })
    invalidatePublicSite(id)
    return NextResponse.json({ success: true, data: result, message: `Đã thêm ${result.created} phòng` })
  } catch (error) {
    if (error instanceof RoomError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    console.error('Create rooms error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi thêm phòng' }, { status: 500 })
  }
}
