import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { mergeTranslations } from '@/lib/i18n/translations-input'
import { sortMenuItems } from '@/lib/menu/menu'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { MAX_MENU_ITEMS, createMenuItemSchema, menuAccess } from './menu-api'

type Props = { params: Promise<{ id: string }> }

const badRequest = (error: string) => NextResponse.json({ success: false, error }, { status: 400 })

/** GET — the hotel's restaurant menu, every item (hidden ones too), in menu order. Any member. */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const access = await menuAccess(id, session.session.user.id, false)
  if (!access.ok) return access.response

  const items = await prisma.menuItem.findMany({ where: { propertyId: id } })
  return NextResponse.json({ success: true, data: sortMenuItems(items) })
}

/** POST { name, price, category?, description?, imageUrl?, isAvailable?, translations? } — a new dish, last in the menu. services_manage. */
export async function POST(request: NextRequest, props: Props) {
  const { id } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const access = await menuAccess(id, session.session.user.id, true)
  if (!access.ok) return access.response

  const parsed = createMenuItemSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  try {
    const { translations, ...data } = parsed.data
    const stats = await prisma.menuItem.aggregate({ where: { propertyId: id }, _count: true, _max: { sortOrder: true } })
    if (stats._count >= MAX_MENU_ITEMS) return badRequest(`Thực đơn có tối đa ${MAX_MENU_ITEMS} món`)

    const item = await prisma.menuItem.create({
      data: {
        ...data,
        propertyId: id,
        sortOrder: (stats._max.sortOrder ?? -1) + 1,
        translations: mergeTranslations(null, translations),
      },
    })
    invalidatePublicSite(id)
    return NextResponse.json({ success: true, data: item, message: 'Đã thêm món' })
  } catch (error) {
    console.error('Create menu item error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi thêm món' }, { status: 500 })
  }
}

const changed = () =>
  NextResponse.json({ success: false, error: 'Thực đơn vừa thay đổi, hãy tải lại trang rồi thử lại' }, { status: 409 })

const orderSchema = z.object({
  order: z.array(z.string().min(1)).min(1).max(MAX_MENU_ITEMS),
})

/**
 * PUT { order: [itemId, ...] } — the whole menu in its new order (the
 * dashboard's move up / down): sortOrder becomes each id's place. Every item
 * of the hotel, each once; a list made before someone else added or deleted
 * a dish is refused rather than half applied. services_manage.
 */
export async function PUT(request: NextRequest, props: Props) {
  const { id } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const access = await menuAccess(id, session.session.user.id, true)
  if (!access.ok) return access.response

  const parsed = orderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest('Thứ tự món không hợp lệ')
  const { order } = parsed.data
  if (new Set(order).size !== order.length) return badRequest('Thứ tự món không hợp lệ')

  try {
    const stored = await prisma.menuItem.findMany({ where: { propertyId: id }, select: { id: true } })
    const ids = new Set(stored.map((i) => i.id))
    if (stored.length !== order.length || !order.every((itemId) => ids.has(itemId))) return changed()
    await prisma.$transaction(
      order.map((itemId, sortOrder) => prisma.menuItem.update({ where: { id: itemId, propertyId: id }, data: { sortOrder } }))
    )
    invalidatePublicSite(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    // A dish deleted between the check and the update: nothing was changed (one transaction).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return changed()
    console.error('Reorder menu error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi sắp xếp thực đơn' }, { status: 500 })
  }
}
