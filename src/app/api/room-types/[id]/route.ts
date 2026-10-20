import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { BedType } from '@prisma/client'

const updateRoomTypeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  area: z.number().nullable().optional(),
  bedType: z.string().optional(),
  maxAdults: z.number().int().min(1).optional(),
  maxChildren: z.number().int().min(0).optional(),
  totalRooms: z.number().int().min(1).optional(),
  availableRooms: z.number().int().min(0).optional(),
  baseOccupancy: z.number().int().min(1).optional(),
  maxOccupancy: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  weekdayPrice: z.number().optional(),
  weekendPrice: z.number().optional(),
  amenityIds: z.array(z.string()).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/room-types/[id] - Get single room type
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roomType = await prisma.roomType.findUnique({
      where: { id: params.id },
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
        images: true,
        amenities: { include: { amenity: true } },
        pricing: {
          include: { pricing: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }

    // Check access
    const workspace = roomType.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.length > 0

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: roomType })
  } catch (error) {
    console.error('Get room type error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy thông tin hạng phòng' }, { status: 500 })
  }
}

// PUT /api/room-types/[id] - Update room type
export async function PUT(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roomType = await prisma.roomType.findUnique({
      where: { id: params.id },
      include: {
        pricing: true,
        property: {
          select: {
            workspace: {
              select: {
                ownerId: true,
                members: {
                  where: { userId: session.user.id, role: { in: ['ADMIN', 'MANAGER'] } },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    })

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }

    // Check access
    const workspace = roomType.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isManager = workspace.members.length > 0

    if (!isOwner && !isManager) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }

    const body = await request.json()
    const validation = updateRoomTypeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const data = validation.data

    // Cast bedType to BedType enum
    const bedTypeValue = data.bedType as BedType | undefined

    // Update room type
    const updated = await prisma.roomType.update({
      where: { id: params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.area !== undefined && { area: data.area }),
        ...(bedTypeValue && { bedType: bedTypeValue }),
        ...(data.maxAdults !== undefined && { maxAdults: data.maxAdults }),
        ...(data.maxChildren !== undefined && { maxChildren: data.maxChildren }),
        ...(data.totalRooms !== undefined && { totalRooms: data.totalRooms }),
        ...(data.availableRooms !== undefined && { availableRooms: data.availableRooms }),
        ...(data.baseOccupancy !== undefined && { baseOccupancy: data.baseOccupancy }),
        ...(data.maxOccupancy !== undefined && { maxOccupancy: data.maxOccupancy }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        // Update pricing if provided
        ...((data.weekdayPrice !== undefined || data.weekendPrice !== undefined) && {
          pricing: {
            update: {
              where: { id: roomType.pricing[0]?.id },
              data: {
                weekdayPrice: data.weekdayPrice,
                weekendPrice: data.weekendPrice,
              },
            },
          },
        }),
        // Update amenities if provided
        ...(data.amenityIds && {
          amenities: {
            deleteMany: {},
            create: data.amenityIds.map((id) => ({ amenityId: id })),
          },
        }),
      },
      include: {
        images: true,
        amenities: { include: { amenity: true } },
        pricing: true,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: roomType.propertyId,
        action: 'UPDATE',
        entityType: 'ROOM_TYPE',
        entityId: params.id,
        changes: data,
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Cập nhật hạng phòng thành công',
    })
  } catch (error) {
    console.error('Update room type error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật hạng phòng' }, { status: 500 })
  }
}

// DELETE /api/room-types/[id] - Delete room type
export async function DELETE(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roomType = await prisma.roomType.findUnique({
      where: { id: params.id },
      include: {
        property: {
          select: {
            workspace: {
              select: {
                ownerId: true,
                members: {
                  where: { userId: session.user.id, role: { in: ['ADMIN', 'MANAGER'] } },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    })

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
    }

    // Check access
    const workspace = roomType.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isManager = workspace.members.length > 0

    if (!isOwner && !isManager) {
      return NextResponse.json({ success: false, error: 'Không có quyền xóa' }, { status: 403 })
    }

    // Delete room type (cascades to images, amenities, pricing via Prisma)
    await prisma.roomType.delete({
      where: { id: params.id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: roomType.propertyId,
        action: 'DELETE',
        entityType: 'ROOM_TYPE',
        entityId: params.id,
        metadata: { name: roomType.name },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa hạng phòng thành công',
    })
  } catch (error) {
    console.error('Delete room type error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa hạng phòng' }, { status: 500 })
  }
}
