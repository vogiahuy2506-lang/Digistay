import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const updateBookingSchema = z.object({
  guestName: z.string().min(2).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().min(10).optional(),
  guestNote: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']).optional(),
  roomNumber: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        bookingItems: true,
        property: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            address: true,
            phone: true,
            workspace: {
              select: {
                id: true,
                ownerId: true,
                members: {
                  where: { userId: session.user.id },
                  select: { role: true },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isMember = workspace.members.length > 0
    const isGuest = booking.guestEmail === session.user.email

    if (!isOwner && !isMember && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: booking })
  } catch (error) {
    console.error('Get booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy thông tin đặt phòng' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        property: {
          select: {
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
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check admin access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isAdmin = workspace.members.some(m => ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role))

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }

    const body = await request.json()
    const validation = updateBookingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const data = validation.data

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        ...data,
        // Update room number in booking item if provided
        ...(data.roomNumber && {
          bookingItems: {
            updateMany: {
              where: { bookingId: id },
              data: { roomNumber: data.roomNumber },
            },
          },
        }),
      },
      include: {
        bookingItems: true,
        property: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        changes: data,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Cập nhật đặt phòng thành công',
    })
  } catch (error) {
    console.error('Update booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật đặt phòng' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        property: {
          select: {
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
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check admin access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isAdmin = workspace.members.some(m => ['ADMIN', 'MANAGER'].includes(m.role))

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Không có quyền xóa' }, { status: 403 })
    }

    // Only allow delete for cancelled or no-show bookings
    if (!['CANCELLED', 'NO_SHOW', 'PENDING'].includes(booking.status)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chỉ có thể xóa đơn đã hủy hoặc không đến' 
      }, { status: 400 })
    }

    await prisma.booking.delete({ where: { id } })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'DELETE',
        entityType: 'BOOKING',
        entityId: id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa đặt phòng thành công',
    })
  } catch (error) {
    console.error('Delete booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa đặt phòng' }, { status: 500 })
  }
}
