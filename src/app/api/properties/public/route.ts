import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/properties/public
 * Get property info by subdomain (public, no auth required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')
    const id = searchParams.get('id')

    if (!subdomain && !id) {
      return NextResponse.json(
        { success: false, error: 'Cần cung cấp subdomain hoặc id' },
        { status: 400 }
      )
    }

    const where = subdomain
      ? { subdomain, isActive: true }
      : { id: id!, isActive: true }

    const property = await prisma.property.findFirst({
      where,
      select: {
        id: true,
        name: true,
        subdomain: true,
        type: true,
        description: true,
        address: true,
        city: true,
        district: true,
        country: true,
        phone: true,
        email: true,
        logo: true,
        coverImage: true,
        latitude: true,
        longitude: true,
        roomTypes: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            totalRooms: true,
          },
        },
      },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy cơ sở' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: property,
    })
  } catch (error) {
    console.error('Get public property error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi lấy thông tin cơ sở' },
      { status: 500 }
    )
  }
}
