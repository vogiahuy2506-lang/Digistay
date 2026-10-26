import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { deletedWorkspaceForOwner } from '@/lib/deletion/deletion'
import { canRestore } from '@/lib/deletion/rules'

/**
 * POST /api/workspaces/[id]/restore — the owner brings back a workspace
 * deleted less than 30 days ago (src/lib/deletion): its members, properties
 * and sites as they were (a property deleted on its own before stays deleted).
 * Its plan was left alone, so it continues with the same end date. Not
 * refused while the plan is locked: paying happens inside the workspace.
 * Its slug was kept for it (a unique column the deleted row still holds).
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const userId = session.user.id

    const found = await deletedWorkspaceForOwner(id, userId)
    if (!found.ok) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy workspace đã xoá' }, { status: 404 })
    }
    const workspace = found.row
    if (!canRestore(workspace.deletedAt)) {
      return NextResponse.json(
        { success: false, error: 'Đã quá 30 ngày kể từ khi xoá nên không thể khôi phục workspace này' },
        { status: 410 }
      )
    }

    const restored = await prisma.$transaction(async (tx) => {
      // Only the deletion that was checked: not one the purge got to first.
      const { count } = await tx.workspace.updateMany({
        where: { id, deletedAt: workspace.deletedAt },
        data: { deletedAt: null, deletedById: null },
      })
      if (count === 0) return false
      await tx.activityLog.create({
        data: {
          userId,
          workspaceId: id,
          action: 'RESTORE',
          entityType: 'WORKSPACE',
          entityId: id,
          metadata: { name: workspace.name, deletedAt: workspace.deletedAt.toISOString() },
        },
      })
      return true
    })
    if (!restored) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy workspace đã xoá' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { id, slug: workspace.slug },
      message: 'Đã khôi phục workspace',
    })
  } catch (error) {
    console.error('Restore workspace error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi khôi phục workspace' }, { status: 500 })
  }
}
