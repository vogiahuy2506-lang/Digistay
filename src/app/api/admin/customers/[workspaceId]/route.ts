import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { WORKSPACE_NOT_FOUND, customerDetail } from '@/lib/admin/customers'

export const dynamic = 'force-dynamic'

/** GET /api/admin/customers/[workspaceId] — one workspace in detail (src/lib/admin/customers.ts). */
export async function GET(_request: NextRequest, props: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await props.params
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const detail = await customerDetail(workspaceId)
  if (!detail) return NextResponse.json({ success: false, error: WORKSPACE_NOT_FOUND }, { status: 404 })
  return NextResponse.json({ success: true, data: detail }, { headers: { 'Cache-Control': 'no-store' } })
}
