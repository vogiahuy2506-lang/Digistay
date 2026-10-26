import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { lockedResponse } from '@/lib/billing/guard'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  priceType: z.enum(['FIXED', 'PER_NIGHT', 'PER_PERSON']).optional(),
  price: z.number().nonnegative().optional(),
  perPerson: z.boolean().optional(),
  isActive: z.boolean().optional(),
  translations: translationsInput(['name', 'description']),
})

async function userCanManageService(serviceId: string, userId: string) {
  const service = await prisma.extraService.findUnique({
    where: { id: serviceId },
    include: {
      property: {
        include: {
          workspace: {
            select: {
              ownerId: true,
              members: {
                where: { userId, role: { in: ['ADMIN', 'MANAGER'] }, planLockedAt: null },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  })
  if (!service) return { ok: false as const, status: 404, error: 'Không tìm thấy dịch vụ' }
  const ws = service.property.workspace
  if (ws.ownerId !== userId && ws.members.length === 0) {
    return { ok: false as const, status: 403, error: 'Không có quyền' }
  }
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

    const { translations, ...fields } = validation.data
    const updated = await prisma.extraService.update({
      where: { id: params.id },
      data: { ...fields, translations: mergeTranslations(authz.service.translations, translations) },
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
