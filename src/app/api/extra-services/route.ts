import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { lockedResponseForProperty } from '@/lib/billing/guard'

const serviceSchema = z.object({
  propertyId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  priceType: z.enum(['FIXED', 'PER_NIGHT', 'PER_PERSON']).default('FIXED'),
  price: z.number().nonnegative(),
  perPerson: z.boolean().default(false),
  isActive: z.boolean().default(true),
  translations: translationsInput(['name', 'description']),
})

async function userOwnsProperty(propertyId: string, userId: string) {
  return prisma.property.findFirst({
    where: {
      id: propertyId,
      workspace: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: { in: ['ADMIN', 'MANAGER'] } } } },
        ],
      },
    },
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

    const ok = await userOwnsProperty(propertyId, session.user.id)
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

    const ok = await userOwnsProperty(validation.data.propertyId, session.user.id)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền thêm dịch vụ' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(validation.data.propertyId)
    if (locked) return locked

    const { translations, ...fields } = validation.data
    const service = await prisma.extraService.create({
      data: { ...fields, translations: mergeTranslations(null, translations) },
    })
    invalidatePublicSite(service.propertyId)
    return NextResponse.json({ success: true, data: service, message: 'Đã thêm dịch vụ' })
  } catch (error) {
    console.error('Create extra service error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi thêm dịch vụ' }, { status: 500 })
  }
}
