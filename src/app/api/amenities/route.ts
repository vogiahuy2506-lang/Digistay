import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { amenitySchema } from '@/lib/validations'
import { slugify, generateSlug } from '@/lib/utils'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const amenities = await prisma.amenity.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    })

    // Group by category
    const groupedAmenities = amenities.reduce((acc, amenity) => {
      if (!acc[amenity.category]) {
        acc[amenity.category] = []
      }
      acc[amenity.category].push(amenity)
      return acc
    }, {} as Record<string, typeof amenities>)

    return NextResponse.json({
      success: true,
      data: {
        amenities,
        grouped: groupedAmenities,
      },
    })
  } catch (error) {
    console.error('Get all amenities error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách tiện ích' },
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

    // Amenities have no workspace: every hotel picks from this one list, so
    // only the platform adds to it. Role read from the database, not the
    // session token, which can be up to 30 days old.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Chỉ quản trị viên Digistay được thêm tiện ích dùng chung' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = amenitySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, icon, category } = validation.data
    const slug = slugify(name)

    // Check if amenity with same name exists
    const existingAmenity = await prisma.amenity.findFirst({
      where: { slug },
    })

    if (existingAmenity) {
      return NextResponse.json(
        { success: false, error: 'Tiện ích này đã tồn tại' },
        { status: 400 }
      )
    }

    const amenity = await prisma.amenity.create({
      data: {
        name,
        slug,
        icon,
        category,
      },
    })

    return NextResponse.json({
      success: true,
      data: amenity,
      message: 'Tạo tiện ích thành công',
    })
  } catch (error) {
    console.error('Create amenity error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tạo tiện ích' },
      { status: 500 }
    )
  }
}
