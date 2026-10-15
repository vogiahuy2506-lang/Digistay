import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

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

    const amenities = await prisma.propertyAmenity.findMany({
      where: { propertyId: id },
      include: {
        amenity: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: amenities.map((pa) => pa.amenity),
    })
  } catch (error) {
    console.error('Get amenities error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách tiện ích' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Verify admin access
    const property = await prisma.property.findFirst({
      where: {
        id,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, role: 'ADMIN' } } },
          ],
        },
      },
      include: {
        workspace: {
          select: { id: true },
        },
      },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền cập nhật tiện ích' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { amenityIds } = body

    if (!Array.isArray(amenityIds)) {
      return NextResponse.json(
        { success: false, error: 'Danh sách tiện ích không hợp lệ' },
        { status: 400 }
      )
    }

    // Remove existing amenities
    await prisma.propertyAmenity.deleteMany({
      where: { propertyId: id },
    })

    // Add new amenities
    if (amenityIds.length > 0) {
      await prisma.propertyAmenity.createMany({
        data: amenityIds.map((amenityId: string) => ({
          propertyId: id,
          amenityId,
        })),
      })
    }

    // Get updated amenities
    const amenities = await prisma.propertyAmenity.findMany({
      where: { propertyId: id },
      include: {
        amenity: true,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.workspace.id,
        propertyId: id,
        action: 'UPDATE',
        entityType: 'AMENITIES',
        entityId: id,
        changes: { amenityIds },
      },
    })

    return NextResponse.json({
      success: true,
      data: amenities.map((pa) => pa.amenity),
      message: 'Cập nhật tiện ích thành công',
    })
  } catch (error) {
    console.error('Update amenities error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật tiện ích' },
      { status: 500 }
    )
  }
}
