import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { createPricingSchema, updatePricingSchema } from '@/lib/validations'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { lockedResponseForProperty } from '@/lib/billing/guard'

// Check if user has admin access to property's workspace
async function checkPropertyAdmin(propertyId: string, userId: string) {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspace: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: 'ADMIN', planLockedAt: null } } },
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
      where: {
        id,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, planLockedAt: null } } },
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

    const pricing = await prisma.pricingConfig.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: pricing,
    })
  } catch (error) {
    console.error('Get pricing error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy bảng giá' },
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

    const property = await checkPropertyAdmin(id, session.user.id)
    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tạo bảng giá' },
        { status: 403 }
      )
    }
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

    const body = await request.json()

    // Validate input
    const validation = createPricingSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const pricing = await prisma.pricingConfig.create({
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
        workspaceId: property.workspaceId,
        propertyId: id,
        action: 'CREATE',
        entityType: 'PRICING',
        entityId: pricing.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: pricing,
      message: 'Tạo bảng giá thành công',
    })
  } catch (error) {
    console.error('Create pricing error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tạo bảng giá' },
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

    const body = await request.json()
    const { pricingId, ...updateData } = body

    if (!pricingId) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp ID bảng giá' },
        { status: 400 }
      )
    }

    // Verify access through property
    const property = await prisma.pricingConfig.findFirst({
      where: {
        id: pricingId,
        propertyId: id,
        property: {
          workspace: {
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id, role: 'ADMIN', planLockedAt: null } } },
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
        { success: false, error: 'Bạn không có quyền cập nhật bảng giá này' },
        { status: 403 }
      )
    }
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

    // Validate input
    const validation = updatePricingSchema.safeParse(updateData)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const updatedPricing = await prisma.pricingConfig.update({
      where: { id: pricingId },
      data: validation.data,
    })

    // Log activity
    invalidatePublicSite(id)
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.property.workspaceId,
        propertyId: id,
        action: 'UPDATE',
        entityType: 'PRICING',
        entityId: pricingId,
        changes: validation.data,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedPricing,
      message: 'Cập nhật bảng giá thành công',
    })
  } catch (error) {
    console.error('Update pricing error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật bảng giá' },
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
    const pricingId = searchParams.get('pricingId')

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    if (!pricingId) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp ID bảng giá' },
        { status: 400 }
      )
    }

    // Verify access
    const property = await prisma.pricingConfig.findFirst({
      where: {
        id: pricingId,
        propertyId: id,
        property: {
          workspace: {
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id, role: 'ADMIN', planLockedAt: null } } },
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
        { success: false, error: 'Bạn không có quyền xóa bảng giá này' },
        { status: 403 }
      )
    }
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

    await prisma.pricingConfig.delete({
      where: { id: pricingId },
    })

    // Log activity
    invalidatePublicSite(id)
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.property.workspaceId,
        propertyId: id,
        action: 'DELETE',
        entityType: 'PRICING',
        entityId: pricingId,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa bảng giá thành công',
    })
  } catch (error) {
    console.error('Delete pricing error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa bảng giá' },
      { status: 500 }
    )
  }
}
