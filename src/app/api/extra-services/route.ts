import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { accessibleProperties } from '@/lib/auth/access'
import type { Permission } from '@/lib/auth/permissions'

const serviceSchema = z.object({
  propertyId: z.string(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  priceType: z.enum(['FIXED', 'PER_NIGHT', 'PER_PERSON']).default('FIXED'),
  price: z.number().nonnegative(),
  perPerson: z.boolean().default(false),
  isActive: z.boolean().default(true),
  coverImage: z.string().url().optional().nullable().or(z.literal('')),
  leadTimeHours: z.number().int().nonnegative().default(0),
  dailyCapacity: z.number().int().positive().optional().nullable(),
  operatingHours: z.string().max(100).optional().nullable(),
  showOnBooking: z.boolean().default(true),
  translations: translationsInput(['name', 'description']),
})

/** The property, if the caller reaches it with `permission` (null: any access). */
async function reachableProperty(propertyId: string, userId: string, permission: Permission | null) {
  return prisma.property.findFirst({
    where: { id: propertyId, ...accessibleProperties(userId, permission) },
    select: { id: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    const ok = await reachableProperty(propertyId, session.user.id, null)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const services = await prisma.extraService.findMany({
      where: { propertyId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: services })
  } catch (error) {
    console.error('List extra services error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy dịch vụ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json()
    const validation = serviceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const ok = await reachableProperty(validation.data.propertyId, session.user.id, 'services_manage')
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền thêm dịch vụ' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(validation.data.propertyId)
    if (locked) return locked

    const { translations, coverImage, dailyCapacity, operatingHours, description, category, ...fields } = validation.data
    const service = await prisma.extraService.create({
      data: {
        ...fields,
        description: description || null,
        category: category || null,
        coverImage: coverImage && coverImage.trim() ? coverImage.trim() : null,
        dailyCapacity: dailyCapacity && dailyCapacity > 0 ? dailyCapacity : null,
        operatingHours: operatingHours && operatingHours.trim() ? operatingHours.trim() : null,
        translations: mergeTranslations(null, translations),
      },
    })
    invalidatePublicSite(service.propertyId)
    return NextResponse.json({ success: true, data: service, message: 'Đã thêm dịch vụ' })
  } catch (error) {
    console.error('Create extra service error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi thêm dịch vụ' }, { status: 500 })
  }
}
