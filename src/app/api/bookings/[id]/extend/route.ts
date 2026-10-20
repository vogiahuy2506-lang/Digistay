import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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

    // Staff only. Guests used to be let in too, and the payment added here
    // defaults to CASH, recorded PAID: a guest could mark their own extra
    // nights paid. No guest-facing page calls this route.
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.some(m =>
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )

    if (!isOwner && !isStaff) {
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

    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId },
      include: {
        pricing: {
          include: { pricing: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    const pricingConfig = roomType?.pricing[0]?.pricing
    const weekdayPrice = pricingConfig?.weekdayPrice || 0
    const weekendPrice = pricingConfig?.weekendPrice || weekdayPrice

    // Calculate additional charges
    const extraNights = Math.ceil(
      (newCheckOut.getTime() - currentCheckOut.getTime()) / (1000 * 60 * 60 * 24)
    )

    let extraWeekendNights = 0
    let extraWeekdayNights = 0
    for (let d = new Date(currentCheckOut); d < newCheckOut; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day === 0 || day === 6) extraWeekendNights++
      else extraWeekdayNights++
    }

    const additionalCharge = (extraWeekdayNights * weekdayPrice) + (extraWeekendNights * weekendPrice)
    const method = paymentMethod || 'CASH'

    // New total, the optional payment and the payment status change together.
    const updatedBooking = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)
      const fresh = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: { totalAmount: true, extraCharges: true },
      })
      await tx.booking.update({
        where: { id },
        data: {
          checkOutDate: newCheckOut,
          totalAmount: fresh.totalAmount + additionalCharge,
          extraCharges: fresh.extraCharges + additionalCharge,
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
    console.error('Extend booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi gia hạn đặt phòng' }, { status: 500 })
  }
}
