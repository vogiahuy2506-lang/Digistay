import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/rbac'
import { isPlatformAdmin, systemStatus } from '@/lib/ops/system-status'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/system — the system page's data (src/lib/ops/system-status.ts).
 * SUPER_ADMIN only, checked in the database; anyone else gets 404, so the
 * page does not show it exists.
 */
export async function GET() {
  const sess = await requireSession()
  if (!sess.ok) return sess.response
  if (!(await isPlatformAdmin(sess.session.user.id))) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: await systemStatus() }, { headers: { 'Cache-Control': 'no-store' } })
}
