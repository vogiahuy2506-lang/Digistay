import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { lockedResponse } from '@/lib/billing/guard'
import { checkPropertyAccess } from '@/lib/auth/access'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  priceType: z.enum(['FIXED', 'PER_NIGHT', 'PER_PERSON']).optional(),
  price: z.number().nonnegative().optional(),
  perPerson: z.boolean().optional(),
  isActive: z.boolean().optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal('')),
  leadTimeHours: z.number().int().nonnegative().optional(),
  dailyCapacity: z.number().int().positive().optional().nullable(),
  operatingHours: z.string().max(100).optional().nullable(),
  showOnBooking: z.boolean().optional(),
  translations: translationsInput(['name', 'description']),
})

async function userCanManageService(serviceId: string, userId: string) {
  const service = await prisma.extraService.findUnique({
    where: { id: serviceId },
    include: { property: { select: { workspaceId: true } } },
  })
  if (!service) return { ok: false as const, status: 404, error: 'Không tìm thấy dịch vụ' }
  const access = await checkPropertyAccess(userId, service.propertyId, 'services_manage')
  if (!access.ok) return { ok: false as const, status: 403, error: 'Không có quyền' }
  return { ok: true as const, service }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const authz = await userCanManageService(params.id, session.user.id)
    if (!authz.ok) {
      return NextResponse.json({ success: false, error: authz.error }, { status: authz.status })
    }
    const locked = await lockedResponse(authz.service.property.workspaceId)
    if (locked) return locked

    const body = await request.json()
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { translations, coverImage, dailyCapacity, operatingHours, description, category, ...fields } = validation.data
    const dataToUpdate: Record<string, unknown> = {
      ...fields,
      translations: mergeTranslations(authz.service.translations, translations),
    }
    if (description !== undefined) dataToUpdate.description = description || null
    if (category !== undefined) dataToUpdate.category = category || null
    if (coverImage !== undefined) dataToUpdate.coverImage = coverImage && coverImage.trim() ? coverImage.trim() : null
    if (dailyCapacity !== undefined) dataToUpdate.dailyCapacity = dailyCapacity && dailyCapacity > 0 ? dailyCapacity : null
    if (operatingHours !== undefined) dataToUpdate.operatingHours = operatingHours && operatingHours.trim() ? operatingHours.trim() : null

    const updated = await prisma.extraService.update({
      where: { id: params.id },
      data: dataToUpdate,
    })
    invalidatePublicSite(updated.propertyId)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update extra service error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const authz = await userCanManageService(params.id, session.user.id)
    if (!authz.ok) {
      return NextResponse.json({ success: false, error: authz.error }, { status: authz.status })
    }
    const locked = await lockedResponse(authz.service.property.workspaceId)
    if (locked) return locked
    const deleted = await prisma.extraService.delete({ where: { id: params.id } })
    invalidatePublicSite(deleted.propertyId)
    return NextResponse.json({ success: true, message: 'Đã xóa dịch vụ' })
  } catch (error) {
    console.error('Delete extra service error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa' }, { status: 500 })
  }
}
