import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { accessibleProperties, can, checkPropertyAccess, NO_PERMISSION } from '@/lib/auth/access'
import { DEFAULT_AMENITIES } from '@/lib/amenities/standard-amenities'

const amenityItemSchema = z.object({
  amenityId: z.string(),
  isFeatured: z.boolean().default(false),
  customName: z.string().max(100).optional().nullable(),
  images: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
})

const assignSchema = z.object({
  propertyId: z.string(),
  amenityIds: z.array(z.string()).max(200).optional(),
  amenities: z.array(amenityItemSchema).max(200).optional(),
})

const createCustomAmenitySchema = z.object({
  name: z.string().min(2).max(100),
  category: z.string().default('facility'),
  icon: z.string().optional().nullable(),
  isFeatured: z.boolean().default(false),
})

// GET /api/properties/[id]/amenities — list amenities + selection state
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 })
    }

    let allAmenities = await prisma.amenity.findMany({
      where: {
        OR: [
          { slug: { not: { startsWith: 'custom-' } } },
          { slug: { startsWith: `custom-${params.id}-` } },
          { properties: { some: { propertyId: params.id } } },
        ],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    if (allAmenities.length === 0) {
      await prisma.amenity.createMany({ data: DEFAULT_AMENITIES, skipDuplicates: true })
      allAmenities = await prisma.amenity.findMany({
        where: {
          OR: [
            { slug: { not: { startsWith: 'custom-' } } },
            { slug: { startsWith: `custom-${params.id}-` } },
            { properties: { some: { propertyId: params.id } } },
          ],
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      })
    }

    const selected = await prisma.propertyAmenity.findMany({
      where: { propertyId: params.id },
      select: {
        amenityId: true,
        isFeatured: true,
        customName: true,
        images: true,
        sortOrder: true,
      },
    })

    const selectedMap = new Map(selected.map((s) => [s.amenityId, s]))

    return NextResponse.json({
      success: true,
      data: allAmenities.map((a) => {
        const sel = selectedMap.get(a.id)
        return {
          ...a,
          isSelected: Boolean(sel),
          isFeatured: sel?.isFeatured ?? false,
          customName: sel?.customName ?? null,
          images: sel?.images ?? [],
          sortOrder: sel?.sortOrder ?? 0,
        }
      }),
    })
  } catch (error) {
    console.error('List amenities error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy tiện ích' }, { status: 500 })
  }
}

// PUT /api/properties/[id]/amenities — replace selection
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
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

    const access = await checkPropertyAccess(session.user.id, params.id, null)
    if (!access.ok) return access.response
    if (!can(access.access, 'services_manage', params.id) && !can(access.access, 'property_edit', params.id)) {
      return NextResponse.json({ success: false, error: NO_PERMISSION }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(params.id)
    if (locked) return locked

    // Resolve items from either `amenities` array or legacy `amenityIds`
    const rawItems =
      validation.data.amenities ??
      validation.data.amenityIds?.map((amenityId, idx) => ({
        amenityId,
        isFeatured: false,
        customName: null,
        images: [],
        sortOrder: idx,
      })) ??
      []

    const targetIds = rawItems.map((item) => item.amenityId)

    // Validate every id exists
    const validAmenities = await prisma.amenity.findMany({
      where: { id: { in: targetIds } },
      select: { id: true },
    })
    const validIdSet = new Set(validAmenities.map((a) => a.id))

    await prisma.$transaction([
      prisma.propertyAmenity.deleteMany({ where: { propertyId: params.id } }),
      prisma.propertyAmenity.createMany({
        data: rawItems
          .filter((item) => validIdSet.has(item.amenityId))
          .map((item, idx) => ({
            propertyId: params.id,
            amenityId: item.amenityId,
            isFeatured: Boolean(item.isFeatured),
            customName: item.customName && item.customName.trim() ? item.customName.trim() : null,
            images: Array.isArray(item.images) ? item.images : [],
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx,
          })),
        skipDuplicates: true,
      }),
    ])

    invalidatePublicSite(params.id)
    return NextResponse.json({ success: true, message: 'Đã cập nhật tiện ích' })
  } catch (error) {
    console.error('Assign amenities error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật' }, { status: 500 })
  }
}

// POST /api/properties/[id]/amenities — create a custom amenity for this property
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, params.id, null)
    if (!access.ok) return access.response
    if (!can(access.access, 'services_manage', params.id) && !can(access.access, 'property_edit', params.id)) {
      return NextResponse.json({ success: false, error: NO_PERMISSION }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(params.id)
    if (locked) return locked

    const body = await request.json()
    const validation = createCustomAmenitySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, category, icon, isFeatured } = validation.data
    const baseSlug = slugify(name) || 'amenity'
    const slug = `custom-${params.id}-${baseSlug}-${Date.now().toString(36)}`

    const amenity = await prisma.amenity.create({
      data: {
        name: name.trim(),
        slug,
        category: category || 'facility',
        icon: icon || null,
      },
    })

    await prisma.propertyAmenity.create({
      data: {
        propertyId: params.id,
        amenityId: amenity.id,
        isFeatured: Boolean(isFeatured),
      },
    })

    invalidatePublicSite(params.id)
    return NextResponse.json({
      success: true,
      data: {
        ...amenity,
        isSelected: true,
        isFeatured: Boolean(isFeatured),
        customName: null,
        images: [],
        sortOrder: 0,
      },
      message: 'Đã tạo tiện ích riêng',
    })
  } catch (error) {
    console.error('Create custom amenity error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo tiện ích riêng' }, { status: 500 })
  }
}
