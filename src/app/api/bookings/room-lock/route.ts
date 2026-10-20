import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { lockRoomType, roomsTaken } from '@/lib/bookings/occupancy'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

const lockSchema = z.object({
  propertyId: z.string(),
  roomTypeId: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  customerInfo: z.string().optional(),
  // No bookingId: this endpoint is public, and locks tied to a booking are
  // written server-side (bookings/[id]/extend). A client value could tie a
  // hold to any hotel's booking.
})

const LOCK_DURATION_MINUTES = 15 // Lock for 15 minutes

export async function POST(request: NextRequest) {
  try {
    // Public endpoint and the session id is client-chosen, so without a
    // per-IP cap one client could hold every free room, again and again.
    const byIp = await hit(LIMITS.roomLockIp, getClientIp(request.headers))
    if (!byIp.allowed) {
      return tooManyRequests('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
    }

    const session = await request.headers.get('x-session-id') || randomUUID()
    const body = await request.json()

    const validation = lockSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { propertyId, roomTypeId, checkInDate, checkOutDate, customerInfo } = validation.data
    const lockStart = new Date(checkInDate)
    const lockEnd = new Date(checkOutDate)
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)

    // The room type must be this property's, of an active hotel.
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId, isActive: true, property: { isActive: true } },
      select: { id: true, totalRooms: true },
    })

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }
    if (Number.isNaN(lockStart.getTime()) || Number.isNaN(lockEnd.getTime()) || lockEnd <= lockStart) {
      return NextResponse.json({ success: false, error: 'Ngày không hợp lệ' }, { status: 400 })
    }

    // Same count as bookings (src/lib/bookings/occupancy.ts), under the room
    // type's row lock; this session's earlier hold is replaced, not counted.
    const lock = await prisma.$transaction(async (tx) => {
      await lockRoomType(tx, roomType.id)
      await tx.roomLock.deleteMany({ where: { sessionId: session, type: 'HOLD', bookingId: null } })
      const taken = await roomsTaken(tx, roomType.id, { propertyId, checkIn: lockStart, checkOut: lockEnd })
      if (taken >= roomType.totalRooms) return null
      return tx.roomLock.create({
        data: {
          propertyId,
          roomTypeId,
          lockStart,
          lockEnd,
          type: 'HOLD',
          sessionId: session,
          customerInfo,
          expiresAt,
        },
      })
    })
    if (!lock) {
      return NextResponse.json({ success: false, error: 'Phòng đã hết trong khoảng thời gian này' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      data: {
        lockId: lock.id,
        sessionId: session,
        expiresAt: lock.expiresAt,
        expiresInSeconds: LOCK_DURATION_MINUTES * 60,
      },
      message: `Phòng đã được giữ trong ${LOCK_DURATION_MINUTES} phút`,
    })
  } catch (error) {
    console.error('Lock room error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi giữ phòng' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await request.headers.get('x-session-id')
    const { searchParams } = new URL(request.url)
    const lockId = searchParams.get('lockId')

    if (!session && !lockId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cần cung cấp session ID hoặc lock ID' 
      }, { status: 400 })
    }

    // Delete by lockId or by sessionId. Only guest holds: maintenance and
    // booked locks belong to the hotel and have their own staff routes.
    if (lockId) {
      const { count } = await prisma.roomLock.deleteMany({
        where: { id: lockId, type: 'HOLD' },
      })
      if (count === 0) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy lượt giữ phòng' }, { status: 404 })
      }
    } else if (session) {
      await prisma.roomLock.deleteMany({
        where: {
          sessionId: session,
          type: 'HOLD',
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Đã hủy giữ phòng',
    })
  } catch (error) {
    console.error('Unlock room error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi hủy giữ phòng' }, { status: 500 })
  }
}
