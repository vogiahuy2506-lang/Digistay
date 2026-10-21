import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { updatePropertySchema } from '@/lib/validations'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'

/** The editable fields, and the description in English. */
const patchSchema = updatePropertySchema.extend({ translations: translationsInput(['description'], 2000) })

// Check if user has access to property's workspace
async function checkPropertyAccess(propertyId: string, userId: string) {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspace: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    },
    include: {
      workspace: {
        select: {
          ownerId: true,
          members: { where: { userId }, select: { role: true } },
        },
      },
    },
  })

  if (!property) return { hasAccess: false, isAdmin: false }

  const isOwner = property.workspace.ownerId === userId
  const memberRole = property.workspace.members[0]?.role
  const isAdmin = isOwner || memberRole === 'ADMIN'

  return { hasAccess: true, isAdmin, property }
}

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

    const access = await checkPropertyAccess(id, session.user.id)
    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập cơ sở này' },
        { status: 403 }
      )
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        websiteSettings: { select: { isPublished: true } },
        roomTypes: {
          where: { isActive: true },
          include: {
            images: {
              where: { isPrimary: true },
              take: 1,
            },
            amenities: {
              include: {
                amenity: true,
              },
            },
          },
        },
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
        pricing: {
          where: { isActive: true },
        },
      },
    })

    // Fetch policy separately
    const policy = await prisma.policy.findUnique({
      where: { propertyId: id },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy cơ sở' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { ...property, policy },
    })
  } catch (error) {
    console.error('Get property error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy thông tin cơ sở' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const access = await checkPropertyAccess(id, session.user.id)
    if (!access.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa cơ sở này' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validation = patchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { translations, ...fields } = validation.data
    const stored = translations && (await prisma.property.findUnique({ where: { id }, select: { translations: true } }))
    const property = await prisma.property.update({
      where: { id },
      data: { ...fields, ...(translations && { translations: mergeTranslations(stored?.translations, translations) }) },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Log activity
    invalidatePublicSite(id)

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.workspaceId,
        propertyId: property.id,
        action: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: property.id,
        changes: validation.data,
      },
    })

    return NextResponse.json({
      success: true,
      data: property,
      message: 'Cập nhật cơ sở thành công',
    })
  } catch (error) {
    console.error('Update property error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật cơ sở' },
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

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Only owner can delete
    const property = await prisma.property.findFirst({
      where: {
        id,
        workspace: {
          ownerId: session.user.id,
        },
      },
      select: {
        id: true,
        workspaceId: true,
      },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xóa cơ sở này' },
        { status: 403 }
      )
    }

    await prisma.property.delete({
      where: { id },
    })
    invalidatePublicSite(id)

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.workspaceId,
        action: 'DELETE',
        entityType: 'PROPERTY',
        entityId: id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa cơ sở thành công',
    })
  } catch (error) {
    console.error('Delete property error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa cơ sở' },
      { status: 500 }
    )
  }
}
