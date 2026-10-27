import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LIMIT = 30
const MAX_LIMIT = 50

const listQuery = z.object({
  /** Where the page before ended: base64url "createdAt|id". */
  cursor: z.string().max(200).optional(),
  unread: z.enum(['1']).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(LIMIT),
})

function readCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [iso, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
  const createdAt = new Date(iso)
  if (rest.length || !id || Number.isNaN(createdAt.getTime())) return null
  return { createdAt, id }
}
const makeCursor = (row: { createdAt: Date; id: string }) => Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url')

/**
 * Notices about a deleted property or workspace (src/lib/deletion) leave the
 * bell with it: they would open a page that is gone. Notices carry ids, not
 * relations, so the deleted ones are listed (at most 30 days' worth).
 */
async function liveNotices(): Promise<Prisma.NotificationWhereInput> {
  const [properties, workspaces] = await Promise.all([
    prismaWithDeleted.property.findMany({
      where: { OR: [{ deletedAt: { not: null } }, { workspace: { deletedAt: { not: null } } }] },
      select: { id: true },
    }),
    prismaWithDeleted.workspace.findMany({ where: { deletedAt: { not: null } }, select: { id: true } }),
  ])
  return {
    AND: [
      { OR: [{ propertyId: null }, { propertyId: { notIn: properties.map((p) => p.id) } }] },
      { OR: [{ workspaceId: null }, { workspaceId: { notIn: workspaces.map((w) => w.id) } }] },
    ],
  }
}

/**
 * GET /api/notifications?cursor=&unread=1&limit= — the signed-in user's
 * notices (src/lib/notifications.ts), newest first, and how many are unread:
 * the bell asks for the latest; the notifications page pages through them
 * all with nextCursor, or the unread ones. Only their own.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  const query = listQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  const after = query.success && query.data.cursor ? readCursor(query.data.cursor) : null
  if (!query.success || (query.data.cursor && !after)) {
    return NextResponse.json({ success: false, error: 'Yêu cầu không hợp lệ' }, { status: 400 })
  }
  const { unread: unreadOnly, limit } = query.data
  const userId = session.user.id
  const live = await liveNotices()
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...live,
    ...(unreadOnly && { readAt: null }),
    // Older than the last one shown (ties on the time: by id).
    ...(after && { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] }),
  }
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, type: true, data: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null, ...live } }),
  ])
  const items = rows.slice(0, limit)
  const nextCursor = rows.length > limit ? makeCursor(items[items.length - 1]) : null
  return NextResponse.json({ success: true, data: { items, unread, nextCursor } }, { headers: { 'Cache-Control': 'no-store' } })
}

const readSchema = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
])

/** POST { ids } or { all: true } — marks the user's own notices read. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  const parsed = readSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Yêu cầu không hợp lệ' }, { status: 400 })
  }
  const { count } = await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null, ...('ids' in parsed.data && { id: { in: parsed.data.ids } }) },
    data: { readAt: new Date() },
  })
  return NextResponse.json({ success: true, data: { marked: count } })
}
