import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

/**
 * GET /api/rooms/available
 * Get list of available rooms for a room type within a date range.
 * Used by the walk-in booking flow in the dashboard, so members only: it
 * lists booked room numbers. The public site uses /api/bookings/availability.
 *
 * Once the hotel lists its rooms (src/lib/bookings/rooms.ts) these are its
 * real rooms: the free ones, or with all=1 every room and why it is not
 * free (OCCUPIED by which booking, MAINTENANCE, INACTIVE), with allTypes=1
 * every type's (moving a stay to another type), and excludeBookingId for
 * the stay being moved. Otherwise numbered slots, as before.
 */
const querySchema = z.object({
  propertyId: z.string(),
  roomTypeId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
})

const DAY = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

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

    // The room type, only if it is this property's and the caller is a member
    const roomType = await prisma.roomType.findFirst({
      where: {
        id: roomTypeId,
        property: {
          id: propertyId,
          workspace: {
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id } } },
            ],
          },
        },
      },
      select: {
        id: true,
        name: true,
        totalRooms: true,
      },
    })

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      return NextResponse.json({ success: false, error: 'Ngày không hợp lệ' }, { status: 400 })
    }

    const all = searchParams.get('all') === '1'
    const allTypes = searchParams.get('allTypes') === '1'
    const excludeBookingId = searchParams.get('excludeBookingId') || undefined
    const listed = await prisma.room.findMany({
      where: allTypes ? { propertyId } : { roomTypeId },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, floor: true, isActive: true, roomTypeId: true, roomType: { select: { name: true } } },
    })
    if (listed.length > 0 && checkOutDate.getTime() - checkInDate.getTime() <= 366 * DAY) {
      const ids = listed.map((r) => r.id)
      const [stays, locks] = await Promise.all([
        prisma.bookingItem.findMany({
          where: {
            OR: [{ roomId: { in: ids } }, { roomId: null, roomNumber: { in: listed.map((r) => r.number), mode: 'insensitive' } }],
            booking: {
              propertyId,
              status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
              checkInDate: { lt: checkOutDate },
              checkOutDate: { gt: checkInDate },
              ...(excludeBookingId && { id: { not: excludeBookingId } }),
            },
          },
          select: { roomId: true, roomNumber: true, booking: { select: { bookingCode: true } } },
        }),
        prisma.roomLock.findMany({
          where: { roomId: { in: ids }, type: { in: ['MAINTENANCE', 'BLOCKED'] }, lockStart: { lt: checkOutDate }, lockEnd: { gt: checkInDate } },
          select: { roomId: true },
        }),
      ])
      const occupiedBy = new Map<string, string>()
      for (const stay of stays) {
        const room = stay.roomId ? listed.find((r) => r.id === stay.roomId) : listed.find((r) => r.number.toLowerCase() === stay.roomNumber?.toLowerCase())
        if (room) occupiedBy.set(room.id, stay.booking.bookingCode)
      }
      const closed = new Set(locks.map((l) => l.roomId))
      const rooms = listed.map((r) => ({
        id: r.id,
        number: r.number,
        floor: r.floor,
        roomTypeId: r.roomTypeId,
        roomTypeName: r.roomType.name,
        status: !r.isActive ? 'INACTIVE' : occupiedBy.has(r.id) ? 'OCCUPIED' : closed.has(r.id) ? 'MAINTENANCE' : 'AVAILABLE',
        bookingCode: occupiedBy.get(r.id) ?? null,
      }))
      const shown = all ? rooms : rooms.filter((r) => r.status === 'AVAILABLE')
      return NextResponse.json({
        success: true,
        data: shown,
        meta: { roomTypeId, roomTypeName: roomType.name, listed: true, availableRooms: rooms.filter((r) => r.status === 'AVAILABLE').length, checkIn, checkOut },
      })
    }

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
        listed: false,
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
