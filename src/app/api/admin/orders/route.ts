import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { ORDER_FLAGS, ORDER_STATUSES, listOrders, ordersSummary } from '@/lib/admin/orders'

export const dynamic = 'force-dynamic'

const query = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  flag: z.enum(ORDER_FLAGS).optional(),
  workspace: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

/**
 * GET /api/admin/orders?q=&status=&flag=&workspace=&page= — plan orders,
 * newest first, with the figures above the list (src/lib/admin/orders.ts).
 * An empty parameter is no filter.
 */
export async function GET(request: NextRequest) {
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const params = Object.fromEntries([...request.nextUrl.searchParams].filter(([, value]) => value.trim() !== ''))
  const parsed = query.safeParse(params)
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Bộ lọc không hợp lệ' }, { status: 400 })
  const { q, status, flag, workspace, page } = parsed.data
  const [list, summary] = await Promise.all([listOrders({ q, status, flag, workspaceId: workspace, page }), ordersSummary()])
  return NextResponse.json({ success: true, data: { ...list, summary } }, { headers: { 'Cache-Control': 'no-store' } })
}
