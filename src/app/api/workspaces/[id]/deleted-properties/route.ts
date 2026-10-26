import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deletedPropertiesOf, liveWorkspaceForOwner } from '@/lib/deletion/deletion'

/**
 * GET /api/workspaces/[id]/deleted-properties — the workspace's properties
 * deleted less than 30 days ago, with the days left to restore them
 * ("Đã xoá gần đây" on the workspace home). The owner's only.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  const found = await liveWorkspaceForOwner(id, session.user.id)
  if (!found.ok) {
    return found.status === 404
      ? NextResponse.json({ success: false, error: 'Không tìm thấy workspace' }, { status: 404 })
      : NextResponse.json({ success: false, error: 'Chỉ chủ sở hữu workspace mới có thể khôi phục cơ sở' }, { status: 403 })
  }
  return NextResponse.json({ success: true, data: await deletedPropertiesOf(id) }, { headers: { 'Cache-Control': 'no-store' } })
}
