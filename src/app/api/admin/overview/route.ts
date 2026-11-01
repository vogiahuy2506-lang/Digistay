import { NextResponse } from 'next/server'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { customersSummary } from '@/lib/admin/customers'
import { ordersSummary } from '@/lib/admin/orders'
import { listActivity } from '@/lib/admin/activity'
import { findProblems } from '@/lib/ops/alerts'
import { redisState } from '@/lib/ops/health-checks'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/overview — Executive overview metrics for Super Admin.
 * Combines revenue, workspace growth, platform scale, system health,
 * recent subscription orders, and latest platform activities.
 * Restricted strictly to SUPER_ADMIN.
 */
export async function GET() {
  const guard = await requirePlatformAdmin()
  if (!guard.ok) return guard.response

  const now = new Date()

  const [
    customers,
    orders,
    propertiesCount,
    bookingsCount,
    roomsCount,
    problems,
    redis,
    recentOrdersRaw,
    activityPage,
  ] = await Promise.all([
    customersSummary(now),
    ordersSummary(now),
    prisma.property.count(),
    prisma.booking.count(),
    prisma.room.count(),
    findProblems(now).catch(() => []),
    redisState().catch(() => 'down' as const),
    prismaWithDeleted.subscriptionPayment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderCode: true,
        amount: true,
        status: true,
        plan: true,
        billing: true,
        createdAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    listActivity({ size: 6 }).catch(() => ({ rows: [] })),
  ])

  return NextResponse.json(
    {
      success: true,
      data: {
        customers,
        orders,
        scale: {
          properties: propertiesCount,
          bookings: bookingsCount,
          rooms: roomsCount,
        },
        recentOrders: recentOrdersRaw.map((o) => ({
          id: o.id,
          orderCode: o.orderCode,
          amount: o.amount,
          status: o.status,
          plan: o.plan,
          billing: o.billing,
          createdAt: o.createdAt.toISOString(),
          workspace: o.workspace,
        })),
        recentActivity: activityPage.rows.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt,
          user: a.actor ? { name: a.actor.name, email: a.actor.email ?? '' } : null,
          workspace: a.workspace ? { name: a.workspace.name ?? '', slug: a.workspace.slug ?? '' } : null,
        })),
        system: {
          problemsCount: problems.length,
          redisOk: redis === 'ok',
        },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
