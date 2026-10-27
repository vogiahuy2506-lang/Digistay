import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { uploadImageSchema } from '@/lib/validations'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { accessibleProperties } from '@/lib/auth/access'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
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
      where: { id, ...accessibleProperties(session.user.id) },
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
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
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
      where: { id, ...accessibleProperties(session.user.id, 'property_edit') },
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
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

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
    invalidatePublicSite(id)
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
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params
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

    const property = await prisma.propertyImage.findFirst({
      where: {
        id: imageId,
        propertyId: id,
        property: accessibleProperties(session.user.id, 'property_edit'),
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
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

    await prisma.propertyImage.delete({
      where: { id: imageId },
    })

    // Log activity
    invalidatePublicSite(id)
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
