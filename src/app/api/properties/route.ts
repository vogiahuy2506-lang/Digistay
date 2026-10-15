import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { createPropertySchema } from '@/lib/validations'
import { generateSlug, generateSubdomain } from '@/lib/utils'

// Check if user has access to workspace
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
  })

  return !!workspace
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Build where clause based on whether workspaceId is provided
    const whereClause: any = {}
    if (workspaceId) {
      const hasAccess = await checkWorkspaceAccess(workspaceId, session.user.id)
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: 'Bạn không có quyền truy cập workspace này' },
          { status: 403 }
        )
      }
      whereClause.workspaceId = workspaceId
    } else {
      // Get all workspaces user has access to
      const userWorkspaces = await prisma.workspace.findMany({
        where: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
        select: { id: true },
      })
      whereClause.workspaceId = { in: userWorkspaces.map(ws => ws.id) }
    }

    const properties = await prisma.property.findMany({
      where: whereClause,
      include: {
        roomTypes: {
          select: {
            id: true,
            name: true,
            totalRooms: true,
            availableRooms: true,
            isActive: true,
          },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        _count: {
          select: {
            roomTypes: true,
            images: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: properties,
    })
  } catch (error) {
    console.error('Get properties error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách cơ sở' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { workspaceId, ...propertyData } = body

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp workspace ID' },
        { status: 400 }
      )
    }

    const hasAccess = await checkWorkspaceAccess(workspaceId, session.user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tạo cơ sở trong workspace này' },
        { status: 403 }
      )
    }

    // Validate input
    const validation = createPropertySchema.safeParse(propertyData)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, subdomain, ...rest } = validation.data

    // Generate slug and check uniqueness
    const slug = generateSlug(name)
    const existingProperty = await prisma.property.findUnique({
      where: { slug },
    })

    if (existingProperty) {
      return NextResponse.json(
        { success: false, error: 'Tên cơ sở đã tồn tại, vui lòng chọn tên khác' },
        { status: 400 }
      )
    }

    // Check subdomain uniqueness
    const existingSubdomain = await prisma.property.findUnique({
      where: { subdomain },
    })

    if (existingSubdomain) {
      return NextResponse.json(
        { success: false, error: 'Subdomain đã được sử dụng, vui lòng chọn tên khác' },
        { status: 400 }
      )
    }

    // Create property
    const property = await prisma.property.create({
      data: {
        ...rest,
        name,
        slug,
        subdomain,
        workspaceId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create default policy for the property
    await prisma.policy.create({
      data: {
        propertyId: property.id,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId,
        propertyId: property.id,
        action: 'CREATE',
        entityType: 'PROPERTY',
        entityId: property.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: property,
      message: 'Tạo cơ sở thành công',
    })
  } catch (error) {
    console.error('Create property error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tạo cơ sở' },
      { status: 500 }
    )
  }
}
