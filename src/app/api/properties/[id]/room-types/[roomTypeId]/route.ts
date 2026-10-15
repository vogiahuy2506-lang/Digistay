import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { updateRoomTypeSchema } from '@/lib/validations'

// Check if user has admin access
async function checkRoomTypeAdmin(roomTypeId: string, userId: string) {
  const roomType = await prisma.roomType.findFirst({
    where: {
      id: roomTypeId,
      property: {
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: 'ADMIN' } } },
          ],
        },
      },
    },
    include: {
      property: {
        select: {
          id: true,
          workspaceId: true,
        },
      },
    },
  })

  return roomType
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomTypeId: string }> }
) {
  try {
    const session = await auth()
    const { roomTypeId } = await params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const roomType = await prisma.roomType.findFirst({
      where: {
        id: roomTypeId,
        property: {
          workspace: {
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id } } },
            ],
          },
        },
      },
      include: {
        images: {
          orderBy: [
            { isPrimary: 'desc' },
            { sortOrder: 'asc' },
          ],
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
      },
    })

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hạng phòng' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: roomType,
    })
  } catch (error) {
    console.error('Get room type error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy thông tin hạng phòng' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomTypeId: string }> }
) {
  try {
    const session = await auth()
    const { roomTypeId } = await params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const roomType = await checkRoomTypeAdmin(roomTypeId, session.user.id)
    if (!roomType) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa hạng phòng này' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { amenityIds, ...updateData } = body

    // Validate input
    const validation = updateRoomTypeSchema.safeParse(updateData)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Update room type
    const updatedRoomType = await prisma.roomType.update({
      where: { id: roomTypeId },
      data: validation.data,
      include: {
        amenities: {
          include: {
            amenity: true,
          },
        },
        images: {
          orderBy: [
            { isPrimary: 'desc' },
            { sortOrder: 'asc' },
          ],
        },
      },
    })

    // Update amenities if provided
    if (amenityIds !== undefined) {
      // Remove existing amenities
      await prisma.roomTypeAmenity.deleteMany({
        where: { roomTypeId },
      })

      // Add new amenities
      if (amenityIds.length > 0) {
        await prisma.roomTypeAmenity.createMany({
          data: amenityIds.map((amenityId: string) => ({
            roomTypeId,
            amenityId,
          })),
        })
      }

      // Refetch with amenities
      const roomTypeWithAmenities = await prisma.roomType.findUnique({
        where: { id: roomTypeId },
        include: {
          amenities: {
            include: {
              amenity: true,
            },
          },
          images: true,
        },
      })

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          workspaceId: roomType.property.workspaceId,
          propertyId: roomType.property.id,
          action: 'UPDATE',
          entityType: 'ROOM_TYPE',
          entityId: roomTypeId,
          changes: { amenityIds },
        },
      })

      return NextResponse.json({
        success: true,
        data: roomTypeWithAmenities,
        message: 'Cập nhật hạng phòng thành công',
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedRoomType,
      message: 'Cập nhật hạng phòng thành công',
    })
  } catch (error) {
    console.error('Update room type error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật hạng phòng' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomTypeId: string }> }
) {
  try {
    const session = await auth()
    const { roomTypeId } = await params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const roomType = await checkRoomTypeAdmin(roomTypeId, session.user.id)
    if (!roomType) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xóa hạng phòng này' },
        { status: 403 }
      )
    }

    await prisma.roomType.delete({
      where: { id: roomTypeId },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: roomType.property.workspaceId,
        propertyId: roomType.property.id,
        action: 'DELETE',
        entityType: 'ROOM_TYPE',
        entityId: roomTypeId,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa hạng phòng thành công',
    })
  } catch (error) {
    console.error('Delete room type error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa hạng phòng' },
      { status: 500 }
    )
  }
}
