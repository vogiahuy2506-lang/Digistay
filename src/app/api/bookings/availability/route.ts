import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const querySchema = z.object({
  propertyId: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  numGuests: z.coerce.number().int().min(1).default(1),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = querySchema.safeParse({
      propertyId: searchParams.get('propertyId'),
      checkInDate: searchParams.get('checkInDate'),
      checkOutDate: searchParams.get('checkOutDate'),
      numGuests: searchParams.get('numGuests') || '1',
    })

    if (!query.success) {
      return NextResponse.json({
        success: false,
        error: query.error.errors[0].message,
      }, { status: 400 })
    }

    const { propertyId, checkInDate, checkOutDate, numGuests } = query.data
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)

    // Get all room types with pricing
    const roomTypes = await prisma.roomType.findMany({
      where: {
        propertyId,
        isActive: true,
        maxOccupancy: { gte: numGuests },
      },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        pricing: true,
      },
    })

    // Get bookings that overlap with the requested dates
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        OR: [
          {
            AND: [
              { checkInDate: { lte: checkIn } },
              { checkOutDate: { gt: checkIn } },
            ],
          },
          {
            AND: [
              { checkInDate: { lt: checkOut } },
              { checkOutDate: { gte: checkOut } },
            ],
          },
          {
            AND: [
              { checkInDate: { gte: checkIn } },
              { checkOutDate: { lte: checkOut } },
            ],
          },
        ],
      },
      include: {
        bookingItems: true,
      },
    })

    // Get room locks
    const roomLocks = await prisma.roomLock.findMany({
      where: {
        propertyId,
        type: { in: ['HOLD', 'BOOKED'] },
        lockStart: { lt: checkOut },
        lockEnd: { gt: checkIn },
      },
    })

    // Calculate availability for each room type
    const availability = roomTypes.map(roomType => {
      // Count booked rooms for this room type
      const bookedRooms = overlappingBookings.reduce((count, booking) => {
        return count + booking.bookingItems.filter(
          item => item.roomTypeId === roomType.id
        ).length
      }, 0)

      // Count locked rooms
      const lockedRooms = roomLocks.filter(
        lock => lock.roomTypeId === roomType.id
      ).length

      const availableRooms = Math.max(0, roomType.totalRooms - bookedRooms - lockedRooms)
      const pricing = roomType.pricing[0]

      // Calculate price for the stay
      const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
      let weekendNights = 0
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        const day = d.getDay()
        if (day === 0 || day === 6) weekendNights++
      }
      const weekdayNights = numNights - weekendNights

      const basePrice = (weekdayNights * (pricing?.weekdayPrice || 0)) + 
                        (weekendNights * (pricing?.weekendPrice || 0))

      return {
        id: roomType.id,
        name: roomType.name,
        description: roomType.description,
        area: roomType.area,
        bedType: roomType.bedType,
        maxOccupancy: roomType.maxOccupancy,
        baseOccupancy: roomType.baseOccupancy,
        totalRooms: roomType.totalRooms,
        availableRooms,
        isAvailable: availableRooms > 0,
        image: roomType.images[0]?.url || null,
        amenities: roomType.amenities.map(a => ({
          id: a.amenity.id,
          name: a.amenity.name,
          icon: a.amenity.icon,
        })),
        pricing: {
          basePrice,
          weekdayPrice: pricing?.weekdayPrice || 0,
          weekendPrice: pricing?.weekendPrice || 0,
          extraAdultPrice: pricing?.extraAdultPrice || 0,
          extraChildPrice: pricing?.extraChildPrice || 0,
        },
        numNights,
      }
    })

    // Sort by availability first, then by price
    const sortedAvailability = availability.sort((a, b) => {
      if (a.isAvailable && !b.isAvailable) return -1
      if (!a.isAvailable && b.isAvailable) return 1
      return (a.pricing.basePrice || 0) - (b.pricing.basePrice || 0)
    })

    return NextResponse.json({
      success: true,
      data: sortedAvailability,
      meta: {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        numGuests,
        numNights: Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
      },
    })
  } catch (error) {
    console.error('Check availability error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi kiểm tra phòng trống' }, { status: 500 })
  }
}
