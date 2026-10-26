import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { lockRoomType, roomsTaken } from '@/lib/bookings/occupancy'
import { roomConflictMessage, roomTakenBy } from '@/lib/bookings/rooms'
import { lockedResponse, lockedResponseForProperty } from '@/lib/billing/guard'

const maintenanceSchema = z.object({
  propertyId: z.string(),
  roomTypeId: z.string(),
  /** one room of the type (src/lib/bookings/rooms.ts); none: any room */
  roomId: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/rooms/maintenance
 * Get maintenance locks for a property
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')
    const roomTypeId = searchParams.get('roomTypeId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Cần cung cấp propertyId' }, { status: 400 })
    }

    // Check access
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const where: any = {
      propertyId,
      type: 'MAINTENANCE',
    }

    if (roomTypeId) {
      where.roomTypeId = roomTypeId
    }

    const locks = await prisma.roomLock.findMany({
      where,
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
        room: { select: { id: true, number: true } },
      },
      orderBy: { lockStart: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: locks,
    })
  } catch (error) {
    console.error('Get maintenance locks error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách bảo trì' }, { status: 500 })
  }
}

/**
 * POST /api/rooms/maintenance
 * Create a maintenance lock
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const validation = maintenanceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { propertyId, roomTypeId, roomId, startDate, endDate, reason, notes } = validation.data
    const lockStart = new Date(startDate)
    const lockEnd = new Date(endDate)
    if (Number.isNaN(lockStart.getTime()) || Number.isNaN(lockEnd.getTime()) || lockEnd <= lockStart) {
      return NextResponse.json({ success: false, error: 'Ngày không hợp lệ' }, { status: 400 })
    }

    // Check access
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }
    const locked = await lockedResponse(property.workspaceId)
    if (locked) return locked

    // The room type must be this property's, not just any id the client sends
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId: property.id },
      select: { id: true },
    })
    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }

    const room = roomId
      ? await prisma.room.findFirst({ where: { id: roomId, roomTypeId, propertyId }, select: { id: true, number: true, propertyId: true } })
      : null
    if (roomId && !room) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy phòng' }, { status: 404 })
    }

    // Under the room type's lock, like a booking: the closed room comes out
    // of what is left to sell, so it must not oversell a night.
    const outcome = await prisma.$transaction(async (tx) => {
      await lockRoomType(tx, roomTypeId)
      // Overlapping maintenance of the same room (or, without a room, of the type as a whole).
      const existingLock = await tx.roomLock.findFirst({
        where: { propertyId, roomTypeId, roomId: room?.id ?? null, type: 'MAINTENANCE', lockStart: { lt: lockEnd }, lockEnd: { gt: lockStart } },
      })
      if (existingLock) return { error: 'Đã có lịch bảo trì trùng với khoảng thời gian này', status: 400 }
      if (room) {
        const taken = await roomTakenBy(tx, room, { checkIn: lockStart, checkOut: lockEnd })
        if (taken) return { error: roomConflictMessage(room.number, taken), status: 409 }
      }
      const capacity = await tx.roomType.findUniqueOrThrow({ where: { id: roomTypeId }, select: { totalRooms: true, name: true } })
      const used = await roomsTaken(tx, roomTypeId, { propertyId, checkIn: lockStart, checkOut: lockEnd })
      if (used >= capacity.totalRooms) {
        return { error: `Hạng ${capacity.name} đã kín trong những ngày này: không còn phòng trống để bảo trì`, status: 409 }
      }
      // Create maintenance lock (no expiration for maintenance)
      return { lock: await tx.roomLock.create({
      data: {
        propertyId,
        roomTypeId,
        roomId: room?.id ?? null,
        lockStart,
        lockEnd,
        type: 'MAINTENANCE',
        customerInfo: reason || 'Bảo trì',
        notes,
        expiresAt: null, // Maintenance locks don't expire
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
        room: { select: { id: true, number: true } },
      },
    }) }
    })
    if ('error' in outcome) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: outcome.status })
    }
    const lock = outcome.lock

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId,
        action: 'CREATE',
        entityType: 'MAINTENANCE_LOCK',
        entityId: lock.id,
        metadata: {
          roomTypeId,
          roomNumber: room?.number ?? null,
          startDate,
          endDate,
          reason,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: lock,
      message: 'Đã tạo lịch bảo trì',
    })
  } catch (error) {
    console.error('Create maintenance lock error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo lịch bảo trì' }, { status: 500 })
  }
}

/**
 * DELETE /api/rooms/maintenance
 * Delete a maintenance lock
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const lockId = searchParams.get('lockId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!lockId) {
      return NextResponse.json({ success: false, error: 'Cần cung cấp lockId' }, { status: 400 })
    }

    // Check access via the lock's own property (its room type's property can
    // differ on rows written before room types were checked), and only for
    // maintenance blocks: holds and booked nights are not deleted here.
    const lock = await prisma.roomLock.findFirst({
      where: { id: lockId, type: 'MAINTENANCE' },
      include: {
        property: {
          select: {
            id: true,
            workspace: {
              select: {
                ownerId: true,
                members: {
                  where: { userId: session.user.id },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    })

    const workspace = lock?.property.workspace
    if (!lock || !workspace || (workspace.ownerId !== session.user.id && workspace.members.length === 0)) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy lịch bảo trì' }, { status: 404 })
    }

    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.some(m =>
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, error: 'Không có quyền xóa lịch bảo trì' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(lock.propertyId)
    if (locked) return locked

    await prisma.roomLock.delete({
      where: { id: lock.id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: lock.propertyId,
        action: 'DELETE',
        entityType: 'MAINTENANCE_LOCK',
        entityId: lockId,
        metadata: {
          roomTypeId: lock.roomTypeId,
          startDate: lock.lockStart.toISOString(),
          endDate: lock.lockEnd.toISOString(),
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Đã xóa lịch bảo trì',
    })
  } catch (error) {
    console.error('Delete maintenance lock error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa lịch bảo trì' }, { status: 500 })
  }
}
