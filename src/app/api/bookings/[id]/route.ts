import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ROOM_SEGMENT_SELECT, withRoomTypeNames } from '@/lib/bookings/room-type-names'
import { RoomError, assignRoomTx, normalizeRoomNumber, roomConflictMessage, typedRoomNumberConflict } from '@/lib/bookings/rooms'
import { lockBooking } from '@/lib/payments/booking-payments'
import { z } from 'zod'
import { lockedResponseForProperty } from '@/lib/billing/guard'

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
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        bookingItems: true,
        roomSegments: { orderBy: { fromDate: 'asc' }, select: ROOM_SEGMENT_SELECT },
        property: {
          include: {
            workspace: {
              select: {
                id: true,
                ownerId: true,
                owner: {
                  select: { email: true, name: true },
                },
                members: {
                  where: { userId: session.user.id, planLockedAt: null },
                  select: { role: true },
                },
              },
            },
            policy: {
              select: {
                checkInTime: true,
                checkOutTime: true,
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

    // Outsiders get the same 404 as a missing booking (CLAUDE.md, API rule 3):
    // a 403 told them the id exists.
    if (!isOwner && !isMember && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    const [data] = await withRoomTypeNames([booking])
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy thông tin đặt phòng' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

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
                  where: { userId: session.user.id, planLockedAt: null },
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

    // Check admin access; outsiders get the 404 of a missing booking.
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    if (!isOwner && workspace.members.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }
    const isAdmin = workspace.members.some(m => ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role))

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    const body = await request.json()
    const validation = updateBookingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { roomNumber: typedNumber, ...data } = validation.data
    const roomNumber = typedNumber?.trim() ? normalizeRoomNumber(typedNumber) : undefined

    // A room number is one room: never two stays in it on the same night (rooms.ts).
    let typed = false
    const updatedBooking = await prisma.$transaction(async (tx) => {
      if (roomNumber) {
        const listed = await tx.room.findFirst({ where: { propertyId: booking.propertyId, number: roomNumber }, select: { id: true } })
        if (listed) {
          // One of the hotel's listed rooms: assigned like any room (checks, type move).
          await assignRoomTx(tx, { bookingId: id, roomId: listed.id })
        } else {
          await lockBooking(tx, id)
          const item = await tx.bookingItem.findFirst({ where: { bookingId: id }, select: { roomTypeId: true } })
          if (item && (await tx.room.count({ where: { roomTypeId: item.roomTypeId } })) > 0) {
            throw new RoomError(`Không có phòng ${roomNumber} trong danh sách phòng của khách sạn`, 400)
          }
          const taken = await typedRoomNumberConflict(tx, {
            propertyId: booking.propertyId,
            roomNumber,
            checkIn: booking.checkInDate,
            checkOut: booking.checkOutDate,
            exceptBookingId: id,
          })
          if (taken) throw new RoomError(roomConflictMessage(roomNumber, taken))
          typed = true
        }
      }
      return tx.booking.update({
      where: { id },
      data: {
        ...data,
        ...(typed && {
          bookingItems: {
            updateMany: {
              where: { bookingId: id },
              data: { roomNumber, roomId: null },
            },
          },
          // A typed number is the whole stay's room: a split ends.
          roomSegments: { deleteMany: {} },
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
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        changes: { ...data, ...(roomNumber && { roomNumber }) },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Cập nhật đặt phòng thành công',
    })
  } catch (error) {
    if (error instanceof RoomError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Update booking error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật đặt phòng' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

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
                  where: { userId: session.user.id, planLockedAt: null },
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

    // Check admin access; outsiders get the 404 of a missing booking.
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    if (!isOwner && workspace.members.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }
    const isAdmin = workspace.members.some(m => ['ADMIN', 'MANAGER'].includes(m.role))

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Không có quyền xóa' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

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
