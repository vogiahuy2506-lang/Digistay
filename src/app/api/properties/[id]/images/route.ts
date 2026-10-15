import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { uploadImageSchema } from '@/lib/validations'

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

    const images = await prisma.propertyImage.findMany({
      where: { propertyId: id },
      orderBy: [
        { isPrimary: 'desc' },
        { sortOrder: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: images,
    })
  } catch (error) {
    console.error('Get images error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách hình ảnh' },
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
        { success: false, error: 'Bạn không có quyền tải lên hình ảnh' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = uploadImageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // If setting as primary, unset other primary images
    if (validation.data.isPrimary) {
      await prisma.propertyImage.updateMany({
        where: { propertyId: id, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const image = await prisma.propertyImage.create({
      data: {
        ...validation.data,
        propertyId: id,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.workspace.id,
        propertyId: id,
        action: 'CREATE',
        entityType: 'IMAGE',
        entityId: image.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: image,
      message: 'Tải lên hình ảnh thành công',
    })
  } catch (error) {
    console.error('Upload image error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tải lên hình ảnh' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp ID hình ảnh' },
        { status: 400 }
      )
    }

    // Verify admin access
    const property = await prisma.propertyImage.findFirst({
      where: {
        id: imageId,
        propertyId: id,
        property: {
          workspace: {
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id, role: 'ADMIN' } } },
            ],
          },
        },
      },
      include: {
        property: {
          select: {
            workspaceId: true,
          },
        },
      },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xóa hình ảnh này' },
        { status: 403 }
      )
    }

    await prisma.propertyImage.delete({
      where: { id: imageId },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.property.workspaceId,
        propertyId: id,
        action: 'DELETE',
        entityType: 'IMAGE',
        entityId: imageId,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa hình ảnh thành công',
    })
  } catch (error) {
    console.error('Delete image error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa hình ảnh' },
      { status: 500 }
    )
  }
}
