import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SITE_VISIBILITY_SELECT, siteVisibility } from '@/lib/public-site/visibility'

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
        ...SITE_VISIBILITY_SELECT,
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
        // What a guest may add to a booking (priced by src/lib/pricing/quote.ts).
        extraServices: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, description: true, price: true, priceType: true, perPerson: true },
        },
      },
    })

    // An unpublished hotel is not found, except by its own signed-in members
    // previewing the site (src/lib/public-site/visibility.ts).
    if (!property || !(await siteVisibility(property))) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy cơ sở' },
        { status: 404 }
      )
    }
    // Read to decide, not sent (undefined keys are left out of the JSON).
    const data = { ...property, workspaceId: undefined, websiteSettings: undefined }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Get public property error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi lấy thông tin cơ sở' },
      { status: 500 }
    )
  }
}
