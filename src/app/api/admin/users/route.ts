import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { searchUsers } from '@/lib/admin/users'

export const dynamic = 'force-dynamic'

const query = z.object({
  q: z.string().max(200).optional(),
  locked: z.enum(['1']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

/** GET /api/admin/users?q=&locked=1&page= — accounts (src/lib/admin/users.ts). */
export async function GET(request: NextRequest) {
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Bộ lọc không hợp lệ' }, { status: 400 })
  const data = await searchUsers({ q: parsed.data.q, locked: parsed.data.locked === '1', page: parsed.data.page })
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } })
}
