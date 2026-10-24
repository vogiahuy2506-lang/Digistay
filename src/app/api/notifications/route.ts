import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LIMIT = 30

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
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { id: true, type: true, data: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
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
