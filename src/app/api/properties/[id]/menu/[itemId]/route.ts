import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { mergeTranslations } from '@/lib/i18n/translations-input'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { menuAccess, updateMenuItemSchema } from '../menu-api'

type Props = { params: Promise<{ id: string; itemId: string }> }

const notFound = () => NextResponse.json({ success: false, error: 'Không tìm thấy món' }, { status: 404 })

/** PATCH — change a dish: any of POST's fields. services_manage. */
export async function PATCH(request: NextRequest, props: Props) {
  const { id, itemId } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const access = await menuAccess(id, session.session.user.id, true)
  if (!access.ok) return access.response

  const parsed = updateMenuItemSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })

  try {
    const stored = await prisma.menuItem.findFirst({ where: { id: itemId, propertyId: id }, select: { translations: true } })
    if (!stored) return notFound()
    const { translations, ...data } = parsed.data
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: { ...data, translations: mergeTranslations(stored.translations, translations) },
    })
    invalidatePublicSite(id)
    return NextResponse.json({ success: true, data: item, message: 'Đã lưu món' })
  } catch (error) {
    console.error('Update menu item error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lưu món' }, { status: 500 })
  }
}

/** DELETE — remove a dish from the menu. services_manage. */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id, itemId } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const access = await menuAccess(id, session.session.user.id, true)
  if (!access.ok) return access.response

  try {
    const { count } = await prisma.menuItem.deleteMany({ where: { id: itemId, propertyId: id } })
    if (count === 0) return notFound()
    invalidatePublicSite(id)
    return NextResponse.json({ success: true, message: 'Đã xóa món' })
  } catch (error) {
    console.error('Delete menu item error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa món' }, { status: 500 })
  }
}
