import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

/**
 * GET /api/rooms/available
 * Get list of available rooms for a room type within a date range.
 * Used by the walk-in booking flow.
 */
const querySchema = z.object({
  propertyId: z.string(),
  roomTypeId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const query = querySchema.safeParse({
      propertyId: searchParams.get('propertyId'),
      roomTypeId: searchParams.get('roomTypeId'),
      checkIn: searchParams.get('checkIn'),
      checkOut: searchParams.get('checkOut'),
    })

    if (!query.success) {
      return NextResponse.json({
        success: false,
        error: query.error.errors[0].message,
      }, { status: 400 })
    }

    const { propertyId, roomTypeId, checkIn, checkOut } = query.data
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)

    // Get all bookings that overlap with the requested dates
    // and involve this room type
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        bookingItems: { some: { roomTypeId } },
        OR: [
          { checkInDate: { lte: checkInDate }, checkOutDate: { gt: checkInDate } },
          { checkInDate: { lt: checkOutDate }, checkOutDate: { gte: checkOutDate } },
          { checkInDate: { gte: checkInDate }, checkOutDate: { lte: checkOutDate } },
        ],
      },
      select: {
        bookingItems: {
          where: { roomTypeId },
          select: { roomNumber: true },
        },
      },
    })

    // Get room locks
    const activeLocks = await prisma.roomLock.findMany({
      where: {
        propertyId,
        roomTypeId,
        expiresAt: { gt: new Date() },
        OR: [
          { lockStart: { lte: checkInDate }, lockEnd: { gt: checkInDate } },
          { lockStart: { lt: checkOutDate }, lockEnd: { gte: checkOutDate } },
          { lockStart: { gte: checkInDate }, lockEnd: { lte: checkOutDate } },
        ],
      },
    })

    // Collect booked/occupied room numbers
    const bookedRooms = new Set<string>()
    for (const booking of overlappingBookings) {
      for (const item of booking.bookingItems) {
        if (item.roomNumber) bookedRooms.add(item.roomNumber)
      }
    }

    // Collect locked rooms
    const lockedRooms = new Set<string>()
    // Note: RoomLock doesn't store roomNumber, only roomTypeId
    // In a full implementation, you'd track individual rooms
    // For now, we just return the count of locked slots

    // Get room type info
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId },
      select: {
        id: true,
        name: true,
        totalRooms: true,
      },
    })

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }

    // Calculate available count
    const totalBooked = bookedRooms.size
    const totalLocked = activeLocks.length
    const availableCount = Math.max(0, roomType.totalRooms - totalBooked - totalLocked)

    // Generate a list of available "slots" (room numbers 101, 102, etc.)
    // In a real app, you'd have a separate Room model with specific room numbers
    const availableRooms = []
    for (let i = 1; i <= roomType.totalRooms; i++) {
      const roomNumber = `${i.toString().padStart(3, '0')}` // 001, 002, etc.
      const floor = Math.ceil(i / 10)
      if (!bookedRooms.has(roomNumber)) {
        availableRooms.push({
          id: `slot-${i}`,
          number: roomNumber,
          floor,
          status: 'AVAILABLE',
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: availableRooms,
      meta: {
        roomTypeId,
        roomTypeName: roomType.name,
        totalRooms: roomType.totalRooms,
        availableRooms: availableRooms.length,
        bookedRooms: totalBooked,
        lockedRooms: totalLocked,
        checkIn,
        checkOut,
      },
    })
  } catch (error) {
    console.error('Get available rooms error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách phòng trống' }, { status: 500 })
  }
}
