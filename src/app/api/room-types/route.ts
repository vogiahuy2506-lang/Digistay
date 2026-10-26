import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { planResponse } from '@/lib/billing/guard'
import { z } from 'zod'
import { bedTypeEnum } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'
import { hardCapacityProblem } from '@/lib/bookings/capacity'

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

/** A blank form field ('' or null, and 0 for these) is no value; numbers may come as strings. */
const blank = (v: unknown) => (v === '' || v === null || v === undefined || v === 0 ? undefined : Number(v))
const optionalNumber = z.preprocess(blank, z.number().positive().optional())

// The ranges of createRoomTypeSchema (src/lib/validations), with the form's
// defaults. The form used to send maxAdults/maxChildren it never asked for.
const createSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().trim().min(1).max(100, 'Tên hạng phòng không được quá 100 ký tự'),
  description: z.string().max(1000).nullable().optional(),
  area: optionalNumber,
  bedType: bedTypeEnum,
  maxAdults: z.number().int().min(1, 'Số người lớn tối đa phải ít nhất là 1').max(10).default(2),
  maxChildren: z.number().int().min(0).max(10).default(0),
  totalRooms: z.number().int().min(1, 'Số phòng phải ít nhất là 1').default(1),
  baseOccupancy: z.number().int().min(1).max(10).default(2),
  maxOccupancy: z.number().int().min(1).max(20).default(4),
  weekdayPrice: optionalNumber,
  weekendPrice: optionalNumber,
  amenityIds: z.array(z.string()).optional(),
})

// POST /api/room-types - Create a new room type
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }
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
    } = parsed.data
    if (hardCapacityProblem({ baseOccupancy, maxOccupancy, maxAdults, maxChildren })) {
      return NextResponse.json(
        { success: false, error: 'Sức chứa không hợp lệ: kiểm tra lại số khách và số người lớn, trẻ em tối đa' },
        { status: 400 }
      )
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
    const overPlan = await planResponse(property.workspaceId, 'rooms', totalRooms)
    if (overPlan) return overPlan

    // From the name with Vietnamese letters spelt out ("Phòng Đơn" → phong-don,
    // not "phng-n"), unique within the property.
    const taken = await prisma.roomType.findMany({ where: { propertyId }, select: { slug: true } })
    const slug = generateSlug(name, taken.map((t) => t.slug)) || generateSlug('phong', taken.map((t) => t.slug))

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
        area: area ?? null,
        bedType,
        maxAdults,
        maxChildren,
        totalRooms,
        availableRooms: totalRooms,
        baseOccupancy,
        maxOccupancy,
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
