import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { sendAfterResponse } from '@/lib/email/outbox'
import { BookingError, createBooking } from '@/lib/bookings/create-booking'

const createBookingSchema = z.object({
  propertyId: z.string(),
  guestName: z.string().min(2, 'Tên khách phải có ít nhất 2 ký tự'),
  // Optional for staff: a walk-in may have none (then no confirmation email).
  guestEmail: z.string().trim().email('Email không hợp lệ').optional().or(z.literal('')),
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

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    
    const propertyId = searchParams.get('propertyId')
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Always restrict to properties in workspaces the user owns or belongs
    // to. Without this, a call without propertyId returned every property's
    // bookings. Another tenant's workspaceId just yields an empty list.
    const where: any = {
      property: {
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
        ...(workspaceId && { workspaceId }),
      },
    }

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
          bookingItems: true,
          property: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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

/**
 * POST /api/bookings — staff create a booking for one of their properties.
 * Priced and checked by src/lib/bookings/create-booking.ts, the same path
 * as guests' bookings on the hotel's site (POST /api/public/bookings).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const body = await request.json()

    const validation = createBookingSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const data = validation.data

    // Only members of the property's workspace.
    const property = await prisma.property.findFirst({
      where: {
        id: data.propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
      select: { id: true },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 404 })
    }

    const checkIn = new Date(data.checkInDate)
    const checkOut = new Date(data.checkOutDate)
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return NextResponse.json({ success: false, error: 'Ngày không hợp lệ' }, { status: 400 })
    }

    const { booking, emailIds } = await createBooking({
      propertyId: data.propertyId,
      roomTypeId: data.roomTypeId,
      guestName: data.guestName,
      guestEmail: data.guestEmail ?? '',
      guestPhone: data.guestPhone,
      guestNote: data.guestNote,
      checkIn,
      checkOut,
      numAdults: data.numAdults,
      numChildren: data.numChildren,
      roomNumber: data.roomNumber,
      vat: { company: data.vatCompany, taxCode: data.vatTaxCode, address: data.vatAddress, email: data.vatEmail },
      services: data.extraServices,
      createdById: session.user.id,
    })
    sendAfterResponse(emailIds)

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
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
    if (error instanceof BookingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Create booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo đặt phòng' }, { status: 500 })
  }
}
