import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { activityFacets, activityScope, decodeActivityCursor, listActivity, vietnamMidnight } from '@/lib/admin/activity'

export const dynamic = 'force-dynamic'

// An empty field (`?q=`) is no filter.
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional())
const code = z.string().max(64).regex(/^[A-Za-z0-9_]+$/)
const id = z.string().max(64).regex(/^[A-Za-z0-9_-]+$/)

const filterSchema = z.object({
  q: optional(z.string().max(200)),
  action: optional(code),
  entity: optional(code),
  workspace: optional(id),
  user: optional(id),
})
const day = optional(z.string().refine((d) => vietnamMidnight(d) !== null))
const rangeSchema = z.object({ from: day, to: day }).refine(({ from, to }) => !from || !to || from <= to)
const cursorSchema = optional(z.string().max(200).refine((c) => decodeActivityCursor(c) !== null))

const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 })

/**
 * GET /api/admin/activity — one page of the platform's activity log
 * (src/lib/admin/activity.ts), newest first. Query: q, action, entity,
 * workspace, user, from, to (YYYY-MM-DD, Vietnam time), cursor (the
 * nextCursor of the page before). The first page also brings the filters'
 * choices (facets) and the names of the workspace and user filtered on
 * (scope). Operators only.
 */
export async function GET(request: NextRequest) {
  const guard = await requirePlatformAdmin()
  if (!guard.ok) return guard.response

  const query = Object.fromEntries(request.nextUrl.searchParams)
  const filter = filterSchema.safeParse(query)
  if (!filter.success) return bad('Bộ lọc không hợp lệ')
  const range = rangeSchema.safeParse(query)
  if (!range.success) return bad('Khoảng ngày không hợp lệ')
  const cursor = cursorSchema.safeParse(query.cursor)
  if (!cursor.success) return bad('Trang nhật ký không hợp lệ')

  const { q, action, entity, workspace, user } = filter.data
  const page = await listActivity({ q, action, entityType: entity, workspaceId: workspace, userId: user, ...range.data, cursor: cursor.data })
  const first = !cursor.data
  const [facets, scope] = first ? await Promise.all([activityFacets(), activityScope({ workspaceId: workspace, userId: user })]) : []

  return NextResponse.json(
    { success: true, data: { ...page, ...(first && { facets, scope }) } },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
