import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deletedWorkspacesOf } from '@/lib/deletion/deletion'

export const dynamic = 'force-dynamic'

/**
 * GET /api/workspaces/deleted — the workspaces the signed-in user owns that
 * were deleted less than 30 days ago, with the days left to restore them
 * ("Đã xoá gần đây" on /workspaces). Members never see a deleted workspace.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  return NextResponse.json(
    { success: true, data: await deletedWorkspacesOf(session.user.id) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
