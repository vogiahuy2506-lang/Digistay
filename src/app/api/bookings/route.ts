import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { generateRandomToken } from '@/lib/utils'

class BookingCapacityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookingCapacityError'
  }
}

const createBookingSchema = z.object({
  propertyId: z.string(),
  guestName: z.string().min(2, 'Tên khách phải có ít nhất 2 ký tự'),
  guestEmail: z.string().email('Email không hợp lệ'),
  guestPhone: z.string().min(10, 'Số điện thoại không hợp lệ'),
  guestNote: z.string().optional(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  numAdults: z.number().int().min(1),
  numChildren: z.number().int().min(0).default(0),
  roomTypeId: z.string(),
  roomNumber: z.string().optional(),
  extraServices: z.array(z.object({
    serviceId: z.string(),
    quantity: z.number().int().min(1).default(1),
  })).optional(),
  vatCompany: z.string().optional(),
  vatTaxCode: z.string().optional(),
  vatAddress: z.string().optional(),
  vatEmail: z.string().optional(),
})

function generateBookingCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `DS${timestamp}${random}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    
    const propertyId = searchParams.get('propertyId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Build where clause
    const where: any = {}

    if (propertyId) {
      // Check access to property
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

      where.propertyId = propertyId
    }

    if (status) {
      where.status = status
    }

    if (startDate) {
      where.checkInDate = { ...where.checkInDate, gte: new Date(startDate) }
    }

    if (endDate) {
      where.checkOutDate = { ...where.checkOutDate, lte: new Date(endDate) }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          bookingItems: {
            include: {
              // Room type info would be here
            },
          },
          property: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get bookings error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách đặt phòng' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()

    const validation = createBookingSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const data = validation.data

    // Verify property access
    const property = await prisma.property.findFirst({
      where: {
        id: data.propertyId,
        workspace: {
          OR: [
            { ownerId: session?.user?.id || '' },
            { members: { some: { userId: session?.user?.id || '' } } },
          ],
        },
      },
      include: {
        roomTypes: {
          where: { id: data.roomTypeId },
          include: {
            pricing: true,
          },
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 404 })
    }

    const checkIn = new Date(data.checkInDate)
    const checkOut = new Date(data.checkOutDate)

    // Check room availability
    const roomType = property.roomTypes[0]
    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }

    // -----------------------------------------------------------------
    // Transactionally reserve the room: count overlapping bookings +
    // room locks, then create the booking + lock. Without the
    // transaction two concurrent POSTs can both pass the count check
    // and over-sell the room.
    // -----------------------------------------------------------------
    const overlappingWhere = {
      propertyId: data.propertyId,
      OR: [
        { checkInDate: { lte: checkIn }, checkOutDate: { gt: checkIn } },
        { checkInDate: { lt: checkOut }, checkOutDate: { gte: checkOut } },
        { checkInDate: { gte: checkIn }, checkOutDate: { lte: checkOut } },
      ],
    }

    const booking = await prisma.$transaction(async (tx) => {
      const [activeBookings, activeLocks] = await Promise.all([
        tx.booking.count({
          where: {
            ...overlappingWhere,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          },
        }),
        tx.roomLock.count({
          where: {
            propertyId: data.propertyId,
            roomTypeId: data.roomTypeId,
            expiresAt: { gt: new Date() },
            OR: [
              { lockStart: { lte: checkIn }, lockEnd: { gt: checkIn } },
              { lockStart: { lt: checkOut }, lockEnd: { gte: checkOut } },
              { lockStart: { gte: checkIn }, lockEnd: { lte: checkOut } },
            ],
          },
        }),
      ])

      if (activeBookings + activeLocks >= roomType.totalRooms) {
        // Throw to roll back the (would-be) write
        throw new BookingCapacityError('Phòng đã hết trong khoảng ngày này')
      }

      return tx.booking.create({
        data: {
          bookingCode: generateBookingCode(),
          propertyId: data.propertyId,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          guestNote: data.guestNote,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numAdults: data.numAdults,
          numChildren: data.numChildren,
          status: 'PENDING',
          subtotal,
          extraCharges,
          totalAmount,
          depositAmount: 0,
          source: 'DIRECT',
          createdById: session?.user?.id,
          vatCompany: data.vatCompany,
          vatTaxCode: data.vatTaxCode,
          vatAddress: data.vatAddress,
          vatEmail: data.vatEmail,
          bookingItems: {
            create: {
              roomTypeId: data.roomTypeId,
              roomNumber: data.roomNumber,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              basePrice,
              extraAdultPrice: extraAdults * extraAdultPrice * numNights,
              extraChildPrice: extraChildren * extraChildPrice * numNights,
              totalPrice: totalAmount,
            },
          },
          roomLocks: {
            create: {
              propertyId: data.propertyId,
              roomTypeId: data.roomTypeId,
              lockStart: checkIn,
              lockEnd: checkOut,
              type: 'HOLD',
              expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min hold
            },
          },
        },
        include: {
          bookingItems: true,
          property: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              address: true,
              phone: true,
              city: true,
              workspace: {
                select: {
                  ownerId: true,
                  owner: { select: { email: true, name: true } },
                },
              },
            },
          },
        },
      })
    })

    // Calculate pricing
    const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    const pricing = roomType.pricing[0]

    let basePrice = pricing?.weekdayPrice || 0
    const extraAdultPrice = pricing?.extraAdultPrice || 0
    const extraChildPrice = pricing?.extraChildPrice || 0

    // Calculate weekend nights
    let weekendNights = 0
    for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day === 0 || day === 6) weekendNights++
    }

    const weekdayNights = numNights - weekendNights
    basePrice = (weekdayNights * (pricing?.weekdayPrice || 0)) + 
                (weekendNights * (pricing?.weekendPrice || 0))

    const extraAdults = Math.max(0, data.numAdults - roomType.baseOccupancy)
    const extraChildren = Math.max(0, data.numChildren - 0)
    
    const extraCharges = (extraAdults * extraAdultPrice * numNights) + 
                         (extraChildren * extraChildPrice * numNights)

    const subtotal = basePrice + extraCharges
    const totalAmount = subtotal

    // Create booking

    // Fire-and-forget emails: booking confirmation to guest, new-booking
    // notification to property owner. Errors are logged but do not break
    // the booking flow.
    const manageUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/bookings/${booking.id}`
    const prop = booking.property

    void (async () => {
      try {
        const {
          sendBookingConfirmation,
          sendOwnerNewBooking,
        } = await import('@/lib/email')
        await sendBookingConfirmation({
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          bookingCode: booking.bookingCode,
          propertyName: prop.name,
          propertyAddress: `${prop.address}, ${prop.city}`,
          propertyPhone: prop.phone,
          checkIn: booking.checkInDate.toISOString(),
          checkOut: booking.checkOutDate.toISOString(),
          numAdults: booking.numAdults,
          numChildren: booking.numChildren,
          totalAmount: booking.totalAmount,
          manageUrl,
        })
        if (prop.workspace?.owner?.email) {
          await sendOwnerNewBooking({
            ownerEmail: prop.workspace.owner.email,
            ownerName: prop.workspace.owner.name ?? undefined,
            bookingCode: booking.bookingCode,
            guestName: booking.guestName,
            guestPhone: booking.guestPhone,
            guestEmail: booking.guestEmail,
            propertyName: prop.name,
            checkIn: booking.checkInDate.toISOString(),
            checkOut: booking.checkOutDate.toISOString(),
            totalAmount: booking.totalAmount,
            manageUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/workspace/_/properties/${prop.id}/bookings/${booking.id}`,
          })
        }
      } catch (err) {
        console.error('[booking] Email send failed:', err)
      }
    })()

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session?.user?.id,
        propertyId: data.propertyId,
        action: 'CREATE',
        entityType: 'BOOKING',
        entityId: booking.id,
        metadata: { bookingCode: booking.bookingCode },
      },
    })

    return NextResponse.json({
      success: true,
      data: booking,
      message: 'Tạo đơn đặt phòng thành công',
    })
  } catch (error) {
    if (error instanceof BookingCapacityError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    console.error('Create booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo đặt phòng' }, { status: 500 })
  }
}
