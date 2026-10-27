import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { CUSTOMER_STATES, customersSummary, listCustomers } from '@/lib/admin/customers'

export const dynamic = 'force-dynamic'

const query = z.object({
  q: z.string().max(200).optional(),
  state: z.enum(CUSTOMER_STATES).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

/** GET /api/admin/customers?q=&state=&page= — the workspaces, with the figures on page 1 (src/lib/admin/customers.ts). */
export async function GET(request: NextRequest) {
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Bộ lọc không hợp lệ' }, { status: 400 })
  const { q, state, page } = parsed.data
  const [list, summary] = await Promise.all([listCustomers({ q, state, page }), page === 1 ? customersSummary() : null])
  return NextResponse.json({ success: true, data: { ...list, summary } }, { headers: { 'Cache-Control': 'no-store' } })
}
