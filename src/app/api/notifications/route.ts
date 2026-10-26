import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LIMIT = 30

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
 * GET /api/notifications — the signed-in user's bell (src/lib/notifications.ts):
 * the latest notices and how many are unread. Only their own.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  const userId = session.user.id
  const live = await liveNotices()
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...live },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { id: true, type: true, data: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null, ...live } }),
  ])
  return NextResponse.json({ success: true, data: { items, unread } }, { headers: { 'Cache-Control': 'no-store' } })
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
