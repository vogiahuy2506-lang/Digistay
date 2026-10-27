import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { auth } from '@/lib/auth'
import { createPropertySchema } from '@/lib/validations'
import { generateSlug, generateSubdomain } from '@/lib/utils'
import { planResponse } from '@/lib/billing/guard'
import { accessibleProperties, checkAccess, propertyScope } from '@/lib/auth/access'
import { locationColumns, resolveLocation } from '@/lib/vn-admin/location'

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

    // The properties the caller reaches (a member limited to some sees only
    // those), in one workspace or in all of theirs.
    let whereClause = accessibleProperties(session.user.id)
    if (workspaceId) {
      const granted = await checkAccess(session.user.id, workspaceId, null)
      if (!granted.ok) return granted.response
      whereClause = propertyScope(granted.access)
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

    // Who has properties_create (the "Thêm cơ sở" button follows this).
    const granted = await checkAccess(session.user.id, workspaceId, 'properties_create')
    if (!granted.ok) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tạo cơ sở trong workspace này' },
        { status: 403 }
      )
    }

    // The plan's number of properties (src/lib/billing); also refused while the workspace is locked.
    const overPlan = await planResponse(workspaceId, 'properties', 1)
    if (overPlan) return overPlan

    // Validate input
    const validation = createPropertySchema.safeParse(propertyData)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, subdomain, provinceCode, wardCode, city, ...rest } = validation.data
    // One of the 34 provinces, and the ward one of its own (src/lib/vn-admin).
    const place = resolveLocation({ provinceCode, wardCode, city })
    if (!place.ok || !place.location) {
      return NextResponse.json(
        { success: false, error: place.ok ? 'Vui lòng chọn tỉnh/thành phố' : place.error },
        { status: 400 }
      )
    }

    // Generate slug and check uniqueness. A deleted property keeps its slug
    // and subdomain until it is purged (src/lib/deletion), so they count.
    const slug = generateSlug(name)
    const existingProperty = await prismaWithDeleted.property.findUnique({
      where: { slug },
    })

    if (existingProperty) {
      return NextResponse.json(
        { success: false, error: 'Tên cơ sở đã tồn tại, vui lòng chọn tên khác' },
        { status: 400 }
      )
    }

    // Check subdomain uniqueness
    const existingSubdomain = await prismaWithDeleted.property.findUnique({
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
        ...locationColumns(place.location),
        name,
        slug,
        subdomain,
        workspaceId,
        // A member limited to some properties works on the one they created.
        ...(granted.access.propertyIds !== null && {
          memberAccess: {
            create: { member: { connect: { workspaceId_userId: { workspaceId, userId: session.user.id } } } },
          },
        }),
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
