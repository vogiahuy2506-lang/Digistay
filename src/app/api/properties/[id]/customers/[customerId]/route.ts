import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { z } from 'zod'

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Họ tên không được để trống').max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
})

/**
 * GET /api/properties/[id]/customers/[customerId]
 * Chi tiết khách hàng kèm toàn bộ lịch sử các booking trước đây tại cơ sở.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string; customerId: string }> }
) {
  const { id: propertyId, customerId } = await props.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, propertyId, 'bookings_view', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const customer = await prisma.customerProfile.findFirst({
      where: { id: customerId, propertyId },
    })

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy khách hàng' }, { status: 404 })
    }

    // Tra cứu lịch sử booking tại cơ sở
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        OR: [
          ...(customer.phone ? [{ guestPhone: customer.phone }] : []),
          ...(customer.email ? [{ guestEmail: customer.email }] : []),
        ],
      },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        depositAmount: true,
        checkInDate: true,
        checkOutDate: true,
        createdAt: true,
        bookingItems: {
          select: {
            roomTypeId: true,
            roomNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Batch resolve room type names
    const roomTypeIds = Array.from(
      new Set(
        bookings
          .flatMap((b) => b.bookingItems.map((bi) => bi.roomTypeId))
          .filter((id): id is string => Boolean(id))
      )
    )

    const roomTypes =
      roomTypeIds.length > 0
        ? await prisma.roomType.findMany({
            where: { id: { in: roomTypeIds } },
            select: { id: true, name: true },
          })
        : []

    const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]))

    const formattedBookings = bookings.map((b) => ({
      ...b,
      roomNames: b.bookingItems
        .map((bi) => (bi.roomTypeId ? roomTypeMap.get(bi.roomTypeId) : undefined) || '')
        .filter(Boolean)
        .join(', '),
      roomNumbers: b.bookingItems
        .map((bi) => bi.roomNumber)
        .filter(Boolean)
        .join(', '),
    }))

    return NextResponse.json({
      success: true,
      data: {
        customer,
        bookings: formattedBookings,
      },
    })
  } catch (error) {
    console.error('Fetch customer detail error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tải chi tiết khách hàng' }, { status: 500 })
  }
}

/**
 * PATCH /api/properties/[id]/customers/[customerId]
 * Cập nhật thông tin khách hàng, thẻ phân nhóm (tags) hoặc ghi chú nội bộ (notes).
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; customerId: string }> }
) {
  const { id: propertyId, customerId } = await props.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, propertyId, 'bookings_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => ({}))
    const parsed = updateCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const existing = await prisma.customerProfile.findFirst({
      where: { id: customerId, propertyId },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy khách hàng' }, { status: 404 })
    }

    const updated = await prisma.customerProfile.update({
      where: { id: customerId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email.toLowerCase() }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Cập nhật thông tin khách hàng thành công',
    })
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật khách hàng' }, { status: 500 })
  }
}
