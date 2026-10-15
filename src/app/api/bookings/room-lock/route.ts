import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

const lockSchema = z.object({
  propertyId: z.string(),
  roomTypeId: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  customerInfo: z.string().optional(),
  bookingId: z.string().optional(),
})

const LOCK_DURATION_MINUTES = 15 // Lock for 15 minutes

export async function POST(request: NextRequest) {
  try {
    const session = await request.headers.get('x-session-id') || uuidv4()
    const body = await request.json()

    const validation = lockSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { propertyId, roomTypeId, checkInDate, checkOutDate, customerInfo, bookingId } = validation.data
    const lockStart = new Date(checkInDate)
    const lockEnd = new Date(checkOutDate)
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)

    // Check if room type has availability
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
      select: { totalRooms: true },
    })

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }

    // Count existing locks for this room type in the date range
    const existingLocks = await prisma.roomLock.count({
      where: {
        propertyId,
        roomTypeId,
        type: { in: ['HOLD', 'BOOKED'] },
        lockStart: { lt: lockEnd },
        lockEnd: { gt: lockStart },
        expiresAt: { gt: new Date() }, // Only count non-expired locks
      },
    })

    // Count bookings
    const existingBookings = await prisma.booking.count({
      where: {
        propertyId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        OR: [
          {
            AND: [
              { checkInDate: { lte: lockStart } },
              { checkOutDate: { gt: lockStart } },
            ],
          },
          {
            AND: [
              { checkInDate: { lt: lockEnd } },
              { checkOutDate: { gte: lockEnd } },
            ],
          },
          {
            AND: [
              { checkInDate: { gte: lockStart } },
              { checkOutDate: { lte: lockEnd } },
            ],
          },
        ],
      },
    })

    const totalOccupied = existingLocks + existingBookings

    if (totalOccupied >= roomType.totalRooms) {
      return NextResponse.json({ 
        success: false, 
        error: 'Phòng đã hết trong khoảng thời gian này' 
      }, { status: 400 })
    }

    // Remove any existing locks from this session
    await prisma.roomLock.deleteMany({
      where: {
        sessionId: session,
        type: 'HOLD',
      },
    })

    // Create new lock
    const lock = await prisma.roomLock.create({
      data: {
        propertyId,
        roomTypeId,
        lockStart,
        lockEnd,
        type: 'HOLD',
        sessionId: session,
        customerInfo,
        bookingId,
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        lockId: lock.id,
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

    // Delete by lockId or by sessionId
    if (lockId) {
      await prisma.roomLock.delete({
        where: { id: lockId },
      })
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
