import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/room-types - Get all room types for a property
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 })
    }

    // Verify user has access to this property
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 })
    }

    const roomTypes = await prisma.roomType.findMany({
      where: { propertyId },
      include: {
        images: { where: { isPrimary: true } },
        amenities: { include: { amenity: true } },
        pricing: {
          include: { pricing: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: roomTypes })
  } catch (error) {
    console.error('Error fetching room types:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/room-types - Create a new room type
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      propertyId,
      name,
      description,
      area,
      bedType,
      maxAdults,
      maxChildren,
      totalRooms,
      baseOccupancy,
      maxOccupancy,
      weekdayPrice,
      weekendPrice,
      amenityIds,
    } = body

    // Validate required fields
    if (!propertyId || !name || !bedType) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to this property
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, role: { in: ['ADMIN', 'MANAGER'] } } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found or access denied' }, { status: 404 })
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    // Create room type
    const roomType = await prisma.roomType.create({
      data: {
        propertyId,
        name,
        slug,
        description,
        area: area ? parseFloat(area) : null,
        bedType,
        maxAdults: maxAdults || 2,
        maxChildren: maxChildren || 0,
        totalRooms: totalRooms || 1,
        availableRooms: totalRooms || 1,
        baseOccupancy: baseOccupancy || 2,
        maxOccupancy: maxOccupancy || 4,
        pricing: weekdayPrice || weekendPrice ? {
          create: {
            pricingId: (await prisma.pricingConfig.findFirst({ where: { propertyId } }))?.id
              ?? (await prisma.pricingConfig.create({
                data: {
                  name: 'Default',
                  propertyId,
                  weekdayPrice: weekdayPrice || 0,
                  weekendPrice: weekendPrice || weekdayPrice || 0,
                },
              })).id,
            weekdayPrice: weekdayPrice || 0,
            weekendPrice: weekendPrice || weekdayPrice || 0,
            extraAdultPrice: 0,
            extraChildPrice: 0,
          },
        } : undefined,
        amenities: amenityIds?.length ? {
          create: amenityIds.map((id: string) => ({ amenityId: id })),
        } : undefined,
      },
      include: {
        images: true,
        amenities: { include: { amenity: true } },
        pricing: true,
      },
    })

    return NextResponse.json({ success: true, data: roomType }, { status: 201 })
  } catch (error) {
    console.error('Error creating room type:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
