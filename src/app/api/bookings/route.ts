import { NextRequest, NextResponse } from 'next/server'
import { BookingSource, BookingStatus, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ROOM_SEGMENT_SELECT, withRoomTypeNames } from '@/lib/bookings/room-type-names'
import { z } from 'zod'
import { sendAfterResponse } from '@/lib/email/outbox'
import { BookingError, createBooking } from '@/lib/bookings/create-booking'

const MAX_LIMIT = 100

/** Returns the value when it is one of `allowed`, '' when absent, null when invalid. */
function enumParam<T extends string>(value: string | null, allowed: readonly T[]): T | '' | null {
  if (!value) return ''
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

function positiveInt(value: string | null, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

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
  roomId: z.string().optional(),
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = positiveInt(searchParams.get('page'), 1)
    const limit = Math.min(positiveInt(searchParams.get('limit'), 20), MAX_LIMIT)
    // Code, guest name or phone; searched in the database so it covers every
    // page, not just the rows on screen.
    const q = (searchParams.get('q') ?? '').trim().slice(0, 100)
    // counts=1: also return how many bookings each status tab holds.
    const withCounts = searchParams.get('counts') === '1'

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // An unknown enum value used to reach Prisma and come back as a 500.
    const status = enumParam(searchParams.get('status'), Object.values(BookingStatus))
    const paymentStatus = enumParam(searchParams.get('paymentStatus'), Object.values(PaymentStatus))
    const source = enumParam(searchParams.get('source'), Object.values(BookingSource))
    if (status === null || paymentStatus === null || source === null) {
      return NextResponse.json({ success: false, error: 'Bộ lọc không hợp lệ' }, { status: 400 })
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

    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }

    if (source) {
      where.source = source
    }

    if (q) {
      where.OR = [
        { bookingCode: { contains: q, mode: 'insensitive' } },
        { guestName: { contains: q, mode: 'insensitive' } },
        { guestPhone: { contains: q.replace(/\s+/g, '') } },
      ]
    }

    if (startDate) {
      where.checkInDate = { ...where.checkInDate, gte: new Date(startDate) }
    }

    if (endDate) {
      where.checkOutDate = { ...where.checkOutDate, lte: new Date(endDate) }
    }

    // Tab counts use every filter except the status itself.
    const countsWhere = { ...where }

    if (status) {
      where.status = status
    }

    const [rows, total, groups] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          bookingItems: true,
          roomSegments: { orderBy: { fromDate: 'asc' }, select: ROOM_SEGMENT_SELECT },
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
      withCounts
        ? prisma.booking.groupBy({ by: ['status'], where: countsWhere, _count: { _all: true } })
        : Promise.resolve(null),
    ])

    const bookings = await withRoomTypeNames(rows)

    let statusCounts: Record<string, number> | undefined
    if (groups) {
      statusCounts = { ALL: 0 }
      for (const status of Object.values(BookingStatus)) statusCounts[status] = 0
      for (const group of groups) {
        statusCounts[group.status] = group._count._all
        statusCounts.ALL += group._count._all
      }
    }

    return NextResponse.json({
      success: true,
      data: bookings,
      ...(statusCounts && { statusCounts }),
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
      roomId: data.roomId,
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
