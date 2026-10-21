import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { roomsTakenByType } from '@/lib/bookings/occupancy'
import { quoteStay, ratesFrom } from '@/lib/pricing/quote'

const querySchema = z.object({
  propertyId: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  numGuests: z.coerce.number().int().min(1).default(1),
  /** adults and children apart (the hotel's site): each checked against the room type, children priced as children */
  numAdults: z.coerce.number().int().min(1).max(20).optional(),
  numChildren: z.coerce.number().int().min(0).max(20).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = querySchema.safeParse({
      propertyId: searchParams.get('propertyId'),
      checkInDate: searchParams.get('checkInDate'),
      checkOutDate: searchParams.get('checkOutDate'),
      numGuests: searchParams.get('numGuests') || '1',
      numAdults: searchParams.get('numAdults') ?? undefined,
      numChildren: searchParams.get('numChildren') ?? undefined,
    })

    if (!query.success) {
      return NextResponse.json({
        success: false,
        error: query.error.errors[0].message,
      }, { status: 400 })
    }

    const { propertyId, checkInDate, checkOutDate } = query.data
    // Without the split, every guest counts as an adult (the staff page).
    const adults = query.data.numAdults ?? query.data.numGuests
    const children = query.data.numAdults ? (query.data.numChildren ?? 0) : 0
    const numGuests = adults + children
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      return NextResponse.json({ success: false, error: 'Ngày không hợp lệ' }, { status: 400 })
    }

    // Room types of an active hotel that take this many guests, with their
    // own rates (src/lib/pricing/quote.ts): the same price a booking is charged.
    const roomTypes = await prisma.roomType.findMany({
      where: {
        propertyId,
        isActive: true,
        maxOccupancy: { gte: numGuests },
        // Only with the split: the staff page's numGuests mixes adults and children.
        ...(query.data.numAdults && { maxAdults: { gte: adults }, maxChildren: { gte: children } }),
        property: { isActive: true },
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
        ...ROOM_RATE_INCLUDE,
      },
    })
    const [taken, defaults] = await Promise.all([
      roomsTakenByType(prisma, { propertyId, checkIn, checkOut }),
      propertyRateDefaults(prisma, propertyId),
    ])

    const availability = roomTypes.flatMap((roomType) => {
      const rates = ratesFrom(roomType.pricing[0], defaults)
      // A room type without a price cannot be booked: not offered.
      if (!rates) return []
      const availableRooms = Math.max(0, roomType.totalRooms - (taken.get(roomType.id) ?? 0))
      const quote = quoteStay({ rates, checkIn, checkOut, numAdults: adults, numChildren: children, baseOccupancy: roomType.baseOccupancy })

      return [{
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
          basePrice: quote.basePrice,
          /** room nights + surcharges for these guests, before services */
          total: quote.total,
          ...rates,
        },
        numNights: quote.nights,
      }]
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
        numAdults: adults,
        numChildren: children,
        numNights: Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
      },
    })
  } catch (error) {
    console.error('Check availability error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi kiểm tra phòng trống' }, { status: 500 })
  }
}
