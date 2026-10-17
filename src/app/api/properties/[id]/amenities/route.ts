import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const assignSchema = z.object({
  propertyId: z.string(),
  amenityIds: z.array(z.string()).max(200),
})

// GET /api/properties/[id]/amenities — list amenities + selection state
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const property = await prisma.property.findFirst({
      where: {
        id: params.id,
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
      return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 })
    }

    const [allAmenities, selected] = await Promise.all([
      prisma.amenity.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
      prisma.propertyAmenity.findMany({
        where: { propertyId: params.id },
        select: { amenityId: true },
      }),
    ])

    const selectedIds = new Set(selected.map(s => s.amenityId))

    return NextResponse.json({
      success: true,
      data: allAmenities.map(a => ({ ...a, isSelected: selectedIds.has(a.id) })),
    })
  } catch (error) {
    console.error('List amenities error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy tiện ích' }, { status: 500 })
  }
}

// PUT /api/properties/[id]/amenities — replace selection
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json()
    const validation = assignSchema.safeParse({ ...body, propertyId: params.id })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const property = await prisma.property.findFirst({
      where: {
        id: params.id,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, role: { in: ['ADMIN', 'MANAGER'] } } } },
          ],
        },
      },
      select: { id: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 })
    }

    // Validate every id exists
    const validAmenities = await prisma.amenity.findMany({
      where: { id: { in: validation.data.amenityIds } },
      select: { id: true },
    })
    const validIds = validAmenities.map(a => a.id)

    await prisma.$transaction([
      prisma.propertyAmenity.deleteMany({ where: { propertyId: params.id } }),
      prisma.propertyAmenity.createMany({
        data: validIds.map(amenityId => ({ propertyId: params.id, amenityId })),
        skipDuplicates: true,
      }),
    ])

    return NextResponse.json({ success: true, message: 'Đã cập nhật tiện ích' })
  } catch (error) {
    console.error('Assign amenities error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật' }, { status: 500 })
  }
}
