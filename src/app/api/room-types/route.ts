import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { planResponse } from '@/lib/billing/guard'

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
        // Every photo, the main one first: the room types page counts them and edits them (room-type-photos.tsx).
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
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

const roomTypeTranslations = translationsInput(['name', 'description'])

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
    const translations = roomTypeTranslations.safeParse(body.translations)
    if (!translations.success) {
      return NextResponse.json({ success: false, error: 'Bản tiếng Anh không hợp lệ' }, { status: 400 })
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

    // The plan's number of rooms (src/lib/billing).
    const overPlan = await planResponse(property.workspaceId, 'rooms', totalRooms || 1)
    if (overPlan) return overPlan

    // Generate slug from name
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    // Create or find pricing config for the property
    let pricingConfigId: string = ''
    const existingPricing = await prisma.pricingConfig.findFirst({
      where: { propertyId },
    })

    if (existingPricing) {
      pricingConfigId = existingPricing.id
    } else {
      const newPricing = await prisma.pricingConfig.create({
        data: {
          propertyId,
          name: 'Standard',
          weekdayPrice: weekdayPrice || 0,
          weekendPrice: weekendPrice || weekdayPrice || 0,
          extraAdultPrice: 0,
          extraChildPrice: 0,
        },
      })
      pricingConfigId = newPricing.id
    }

    // Create room type
    const roomType = await prisma.roomType.create({
      data: {
        propertyId,
        name,
        slug,
        description,
        translations: mergeTranslations(null, translations.data),
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
            pricingId: pricingConfigId,
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

    invalidatePublicSite(propertyId)
    return NextResponse.json({ success: true, data: roomType }, { status: 201 })
  } catch (error) {
    console.error('Error creating room type:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
