import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { can, checkPropertyAccess } from '@/lib/auth/access'
import { z } from 'zod'

const NOT_FOUND = 'Không tìm thấy đơn đặt phòng'

const addServiceSchema = z.object({
  serviceId: z.string().optional(),
  name: z.string().trim().min(1, 'Tên dịch vụ không được để trống'),
  unitPrice: z.number().min(0, 'Đơn giá phải lớn hơn hoặc bằng 0'),
  quantity: z.number().int().min(1, 'Số lượng tối thiểu là 1').default(1),
  notes: z.string().trim().optional(),
})

const deleteServiceSchema = z.object({
  index: z.number().int().min(0, 'Vị trí dịch vụ không hợp lệ'),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/bookings/[id]/services
 * Get the services charged on this booking, along with the property's active service catalog.
 */
export async function GET(request: NextRequest, props: RouteParams) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        propertyId: true,
        services: true,
        extraCharges: true,
        totalAmount: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: NOT_FOUND }, { status: 404 })
    }

    const access = await checkPropertyAccess(session.user.id, booking.propertyId, 'bookings_view', NOT_FOUND)
    if (!access.ok) return access.response

    const availableServices = await prisma.extraService.findMany({
      where: { propertyId: booking.propertyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        priceType: true,
        perPerson: true,
        category: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        services: Array.isArray(booking.services) ? booking.services : [],
        extraCharges: booking.extraCharges,
        totalAmount: booking.totalAmount,
        availableServices,
      },
    })
  } catch (error) {
    console.error('Get booking services error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy thông tin dịch vụ' }, { status: 500 })
  }
}

/**
 * POST /api/bookings/[id]/services
 * Frontdesk staff adds an on-stay or extra service to the booking folio.
 */
export async function POST(request: NextRequest, props: RouteParams) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, propertyId: true, status: true },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: NOT_FOUND }, { status: 404 })
    }

    const access = await checkPropertyAccess(session.user.id, booking.propertyId, null, NOT_FOUND)
    if (!access.ok) return access.response
    if (!can(access.access, 'bookings_edit', booking.propertyId)) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }

    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') {
      return NextResponse.json(
        { success: false, error: 'Không thể thêm dịch vụ cho đơn đặt phòng đã đóng hoặc hủy' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = addServiceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const data = validation.data
    const lineAmount = Math.round(data.unitPrice * data.quantity)

    const updated = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)

      const current = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          subtotal: true,
          extraCharges: true,
          discount: true,
          totalAmount: true,
          services: true,
        },
      })

      const existingServices: any[] = Array.isArray(current.services) ? [...current.services] : []
      const newItem = {
        serviceId: data.serviceId || null,
        name: data.name,
        unitPrice: data.unitPrice,
        quantity: data.quantity,
        amount: lineAmount,
        notes: data.notes || null,
        createdAt: new Date().toISOString(),
        addedBy: session.user.name || session.user.email || 'Staff',
      }
      existingServices.push(newItem)

      const newExtraCharges = Math.max(0, current.extraCharges + lineAmount)
      const newTotalAmount = Math.max(0, current.subtotal + newExtraCharges - current.discount)

      const res = await tx.booking.update({
        where: { id },
        data: {
          services: existingServices,
          extraCharges: newExtraCharges,
          totalAmount: newTotalAmount,
        },
      })

      await syncBookingPayments(tx, id)

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          propertyId: booking.propertyId,
          action: 'UPDATE',
          entityType: 'BOOKING',
          entityId: id,
          metadata: {
            action: 'ADD_SERVICE',
            serviceName: data.name,
            quantity: data.quantity,
            amount: lineAmount,
          },
        },
      })

      return res
    })

    return NextResponse.json({
      success: true,
      message: 'Đã thêm dịch vụ vào đơn đặt phòng',
      data: {
        services: updated.services,
        extraCharges: updated.extraCharges,
        totalAmount: updated.totalAmount,
      },
    })
  } catch (error) {
    console.error('Add booking service error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi thêm dịch vụ' }, { status: 500 })
  }
}

/**
 * DELETE /api/bookings/[id]/services
 * Frontdesk staff removes a mistakenly added service from the booking folio.
 */
export async function DELETE(request: NextRequest, props: RouteParams) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, propertyId: true, status: true },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: NOT_FOUND }, { status: 404 })
    }

    const access = await checkPropertyAccess(session.user.id, booking.propertyId, null, NOT_FOUND)
    if (!access.ok) return access.response
    if (!can(access.access, 'bookings_edit', booking.propertyId)) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }

    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa dịch vụ của đơn đặt phòng đã đóng hoặc hủy' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = deleteServiceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const { index } = validation.data

    const updated = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)

      const current = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          subtotal: true,
          extraCharges: true,
          discount: true,
          totalAmount: true,
          services: true,
        },
      })

      const existingServices: any[] = Array.isArray(current.services) ? [...current.services] : []
      if (index < 0 || index >= existingServices.length) {
        throw new Error('Dịch vụ không tồn tại hoặc đã bị xóa')
      }

      const [removed] = existingServices.splice(index, 1)
      const removedAmount = typeof removed.amount === 'number' ? removed.amount : 0

      const newExtraCharges = Math.max(0, current.extraCharges - removedAmount)
      const newTotalAmount = Math.max(0, current.subtotal + newExtraCharges - current.discount)

      const res = await tx.booking.update({
        where: { id },
        data: {
          services: existingServices,
          extraCharges: newExtraCharges,
          totalAmount: newTotalAmount,
        },
      })

      await syncBookingPayments(tx, id)

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          propertyId: booking.propertyId,
          action: 'UPDATE',
          entityType: 'BOOKING',
          entityId: id,
          metadata: {
            action: 'REMOVE_SERVICE',
            serviceName: removed.name,
            amount: removedAmount,
          },
        },
      })

      return res
    })

    return NextResponse.json({
      success: true,
      message: 'Đã xóa dịch vụ khỏi đơn đặt phòng',
      data: {
        services: updated.services,
        extraCharges: updated.extraCharges,
        totalAmount: updated.totalAmount,
      },
    })
  } catch (error: any) {
    console.error('Delete booking service error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi xóa dịch vụ' },
      { status: 500 }
    )
  }
}

