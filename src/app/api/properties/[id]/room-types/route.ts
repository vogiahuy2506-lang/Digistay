import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { createRoomTypeSchema, updateRoomTypeSchema } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'

// Check if user has admin access to property's workspace
async function checkPropertyAdmin(propertyId: string, userId: string) {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspace: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: 'ADMIN' } } },
        ],
      },
    },
    select: {
      id: true,
      workspaceId: true,
    },
  })

  return property
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const property = await prisma.property.findFirst({
      where: {
        id,
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
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập' },
        { status: 403 }
      )
    }

    const roomTypes = await prisma.roomType.findMany({
      where: { propertyId: id },
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: roomTypes,
    })
  } catch (error) {
    console.error('Get room types error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách hạng phòng' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const property = await checkPropertyAdmin(id, session.user.id)
    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tạo hạng phòng' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { amenityIds, ...roomTypeData } = body

    // Validate input
    const validation = createRoomTypeSchema.safeParse(roomTypeData)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, ...rest } = validation.data

    // Generate unique slug
    const slug = generateSlug(name)

    // Check if room type with same name exists
    const existingRoomType = await prisma.roomType.findFirst({
      where: { propertyId: id, slug },
    })

    if (existingRoomType) {
      return NextResponse.json(
        { success: false, error: 'Hạng phòng đã tồn tại trong cơ sở này' },
        { status: 400 }
      )
    }

    // Create room type
    const roomType = await prisma.roomType.create({
      data: {
        ...rest,
        name,
        slug,
        propertyId: id,
        availableRooms: rest.totalRooms || 1,
      },
      include: {
        amenities: {
          include: {
            amenity: true,
          },
        },
        images: true,
      },
    })

    // Add amenities if provided
    if (amenityIds && amenityIds.length > 0) {
      await prisma.roomTypeAmenity.createMany({
        data: amenityIds.map((amenityId: string) => ({
          roomTypeId: roomType.id,
          amenityId,
        })),
      })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.workspaceId,
        propertyId: id,
        action: 'CREATE',
        entityType: 'ROOM_TYPE',
        entityId: roomType.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: roomType,
      message: 'Tạo hạng phòng thành công',
    })
  } catch (error) {
    console.error('Create room type error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tạo hạng phòng' },
      { status: 500 }
    )
  }
}
