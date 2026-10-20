import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { BookingError } from '@/lib/bookings/create-booking'
import { NO_PRICE_MESSAGE, ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { lockRoomType, roomsTaken } from '@/lib/bookings/occupancy'
import { quoteStay, ratesFrom } from '@/lib/pricing/quote'
import { auth } from '@/lib/auth'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'
import { z } from 'zod'

const extendSchema = z.object({
  newCheckOutDate: z.string(),
  addPayment: z.boolean().default(false),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'QR_VIETQR', 'CARD', 'CREDIT_CARD']).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/bookings/[id]/extend
 * Extend a booking's check-out date (late checkout or stay longer)
 */
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json()
    const validation = extendSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { newCheckOutDate, addPayment, paymentMethod } = validation.data
    const newCheckOut = new Date(newCheckOutDate)

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        bookingItems: {
          include: {
            // Room type pricing loaded below
          },
        },
        property: {
          select: {
            id: true,
            name: true,
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
        roomLocks: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.some(m =>
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )
    const isGuest = booking.guestEmail === session.user.email

    if (!isOwner && !isStaff && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền gia hạn đặt phòng' }, { status: 403 })
    }

    // Only checked-in or confirmed bookings can be extended
    if (!['CHECKED_IN', 'CONFIRMED'].includes(booking.status)) {
      return NextResponse.json({
        success: false,
        error: 'Chỉ có thể gia hạn đơn đã xác nhận hoặc đã nhận phòng',
      }, { status: 400 })
    }

    // New checkout must be after current checkout
    const currentCheckOut = new Date(booking.checkOutDate)
    if (newCheckOut <= currentCheckOut) {
      return NextResponse.json({
        success: false,
        error: 'Ngày trả phòng mới phải sau ngày trả phòng hiện tại',
      }, { status: 400 })
    }

    // Get room type pricing
    const roomTypeId = booking.bookingItems[0]?.roomTypeId
    if (!roomTypeId) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy thông tin hạng phòng' }, { status: 400 })
    }

    // The extra nights are priced like a booking (src/lib/pricing/quote.ts):
    // the room type's own rates, surcharges for this booking's guests too.
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId },
      include: ROOM_RATE_INCLUDE,
    })
    const rates = roomType && ratesFrom(roomType.pricing[0], await propertyRateDefaults(prisma, booking.propertyId))
    if (!roomType || !rates) {
      return NextResponse.json({ success: false, error: NO_PRICE_MESSAGE }, { status: 400 })
    }
    const extra = quoteStay({
      rates,
      checkIn: currentCheckOut,
      checkOut: newCheckOut,
      numAdults: booking.numAdults,
      numChildren: booking.numChildren,
      baseOccupancy: roomType.baseOccupancy,
    })
    const additionalCharge = extra.total
    const extraNights = extra.nights
    const method = paymentMethod || 'CASH'

    // New total, the optional payment and the payment status change together.
    const updatedBooking = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)
      // The extra nights must be free: extensions used to oversell.
      await lockRoomType(tx, roomType.id)
      const taken = await roomsTaken(tx, roomType.id, {
        propertyId: booking.propertyId,
        checkIn: currentCheckOut,
        checkOut: newCheckOut,
      })
      if (taken >= roomType.totalRooms) throw new BookingError('Phòng đã kín trong những đêm gia hạn', 409)
      const fresh = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: { subtotal: true, totalAmount: true, extraCharges: true },
      })
      await tx.booking.update({
        where: { id },
        data: {
          checkOutDate: newCheckOut,
          // Room nights to the room total, surcharges to the extra charges.
          subtotal: fresh.subtotal + extra.basePrice,
          extraCharges: fresh.extraCharges + extra.extraCharges,
          totalAmount: fresh.totalAmount + additionalCharge,
        },
      })
      if (addPayment && additionalCharge > 0) {
        await tx.payment.create({
          data: {
            bookingId: id,
            propertyId: booking.propertyId,
            amount: additionalCharge,
            fee: 0,
            netAmount: additionalCharge,
            method,
            status: method === 'CASH' ? 'PAID' : 'PENDING',
            paidAt: method === 'CASH' ? new Date() : null,
            expiresAt: method !== 'CASH' ? new Date(Date.now() + 30 * 60 * 1000) : null,
          },
        })
      }
      // More is owed now: a fully paid booking becomes PARTIAL until the
      // extension is paid (it used to stay PAID), and cash counts in full.
      await syncBookingPayments(tx, id)
      return tx.booking.findUniqueOrThrow({ where: { id } })
    })

    // Update room lock
    if (booking.roomLocks.length > 0) {
      await prisma.roomLock.updateMany({
        where: { bookingId: id },
        data: { lockEnd: newCheckOut },
      })
    } else {
      // Create new lock
      await prisma.roomLock.create({
        data: {
          bookingId: id,
          propertyId: booking.propertyId,
          roomTypeId,
          lockStart: currentCheckOut,
          lockEnd: newCheckOut,
          type: 'BOOKED',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Long expiration for checked-in
        },
      })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'EXTEND',
        entityType: 'BOOKING',
        entityId: id,
        changes: {
          oldCheckOut: booking.checkOutDate.toISOString(),
          newCheckOut: newCheckOut.toISOString(),
          extraNights,
          additionalCharge,
        },
        metadata: {
          bookingCode: booking.bookingCode,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: `Gia hạn thành công. Thêm ${extraNights} đêm, phụ thu ${additionalCharge.toLocaleString('vi-VN')} VNĐ`,
      extraNights,
      additionalCharge,
      newTotal: updatedBooking.totalAmount,
    })
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Extend booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi gia hạn đặt phòng' }, { status: 500 })
  }
}
