import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(
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

    // Check reception access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.some(m => 
      ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    )

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, error: 'Không có quyền check-in' }, { status: 403 })
    }

    // Check booking status
    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      return NextResponse.json({ 
        success: false, 
        error: 'Đơn đặt phòng không ở trạng thái có thể check-in' 
      }, { status: 400 })
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_IN',
        actualCheckIn: new Date(),
        checkedInBy: session.user.id,
      },
      include: {
        bookingItems: true,
        property: {
          select: {
            id: true,
            name: true,
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
        changes: { 
          status: 'CHECKED_IN',
          actualCheckIn: new Date(),
        },
        metadata: { 
          bookingCode: booking.bookingCode,
          checkedInBy: session.user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Check-in thành công',
    })
  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi check-in' }, { status: 500 })
  }
}
