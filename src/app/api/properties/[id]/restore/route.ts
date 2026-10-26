import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { planResponse } from '@/lib/billing/guard'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { deletedPropertyForOwner, roomsOf } from '@/lib/deletion/deletion'
import { canRestore } from '@/lib/deletion/rules'

/**
 * POST /api/properties/[id]/restore — the workspace's owner brings back a
 * property deleted less than 30 days ago (src/lib/deletion), as it was. It
 * counts against the plan again, so it is refused when that passes the
 * plan's properties or rooms, or while the workspace is locked. Its subdomain
 * and custom domain were kept for it (unique columns the deleted row still
 * holds until the purge), so nothing else can have taken them.
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const userId = session.user.id

    const found = await deletedPropertyForOwner(id, userId)
    if (!found.ok) {
      return found.status === 404
        ? NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở đã xoá' }, { status: 404 })
        : NextResponse.json({ success: false, error: 'Chỉ chủ sở hữu workspace mới có thể khôi phục cơ sở' }, { status: 403 })
    }
    const property = found.row
    if (!canRestore(property.deletedAt)) {
      return NextResponse.json(
        { success: false, error: 'Đã quá 30 ngày kể từ khi xoá nên không thể khôi phục cơ sở này' },
        { status: 410 }
      )
    }

    const overPlan =
      (await planResponse(property.workspaceId, 'properties', 1)) ??
      (await planResponse(property.workspaceId, 'rooms', await roomsOf(id)))
    if (overPlan) return overPlan

    const restored = await prisma.$transaction(async (tx) => {
      // Only the deletion that was checked: not one the purge got to first.
      const { count } = await tx.property.updateMany({
        where: { id, deletedAt: property.deletedAt },
        data: { deletedAt: null, deletedById: null },
      })
      if (count === 0) return false
      await tx.activityLog.create({
        data: {
          userId,
          workspaceId: property.workspaceId,
          propertyId: id,
          action: 'RESTORE',
          entityType: 'PROPERTY',
          entityId: id,
          metadata: { name: property.name, deletedAt: property.deletedAt.toISOString() },
        },
      })
      return true
    })
    if (!restored) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở đã xoá' }, { status: 404 })
    }
    invalidatePublicSite(id)

    return NextResponse.json({
      success: true,
      data: { id, workspaceId: property.workspaceId },
      message: 'Đã khôi phục cơ sở',
    })
  } catch (error) {
    console.error('Restore property error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi khôi phục cơ sở' }, { status: 500 })
  }
}
