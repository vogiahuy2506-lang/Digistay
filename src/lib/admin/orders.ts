/**
 * Plan orders for Digistay's operators (/admin/orders): every plan payment
 * (src/lib/billing/checkout.ts), newest first, with what was earned, and
 * what an operator can do about one: cancel a code still waiting, or mark a
 * flagged one (money that came after the code was closed) as looked at.
 *
 * Reads go through prismaWithDeleted: orders of a deleted workspace are
 * money paid to Digistay and stay listed (and searchable by its name).
 */
import type { Prisma, SubscriptionPaymentStatus } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { vietnamMonth } from '@/lib/billing/limits'
import { cancelPlanLinks } from '@/lib/billing/checkout'
import type { PlatformAdmin } from './guard'

export const ORDER_STATUSES = ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'] as const satisfies readonly SubscriptionPaymentStatus[]
/** late: paid after the code was closed; unreviewed: those nobody has looked at yet. */
export const ORDER_FLAGS = ['late', 'unreviewed'] as const
export type OrderFlag = (typeof ORDER_FLAGS)[number]

export interface OrderFilter {
  q?: string
  status?: SubscriptionPaymentStatus
  flag?: OrderFlag
  workspaceId?: string
  page?: number
  size?: number
}

const DAY_MS = 86_400_000
/** What PayOS records for a code an operator cancelled. */
const OPERATOR_REASON = 'Digistay huỷ đơn'

function orderWhere(filter: OrderFilter): Prisma.SubscriptionPaymentWhereInput {
  const q = filter.q?.trim()
  const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const })
  return {
    ...(filter.status && { status: filter.status }),
    ...(filter.workspaceId && { workspaceId: filter.workspaceId }),
    ...(filter.flag && { paidAfter: { not: null } }),
    ...(filter.flag === 'unreviewed' && { reviewedAt: null }),
    ...(q && {
      OR: [
        { orderCode: { startsWith: q } },
        { workspace: { name: contains(q) } },
        { workspace: { slug: contains(q) } },
        { workspace: { owner: { email: contains(q) } } },
      ],
    }),
  }
}

/** One page of plan orders, newest first, with the workspace, buyer, reviewer and e-invoice of each. */
export async function listOrders(filter: OrderFilter) {
  const size = filter.size ?? 25
  const page = Math.max(1, Math.floor(filter.page ?? 1))
  const where = orderWhere(filter)
  const [total, rows] = await Promise.all([
    prismaWithDeleted.subscriptionPayment.count({ where }),
    prismaWithDeleted.subscriptionPayment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * size,
      take: size,
      include: {
        workspace: { select: { id: true, name: true, slug: true, deletedAt: true } },
        invoice: { select: { status: true, einvoiceNumber: true } },
      },
    }),
  ])
  // Neither id has a relation in the schema: one lookup for the page.
  const userIds = [...new Set(rows.flatMap((r) => [r.createdById, r.reviewedById]).filter((id): id is string => Boolean(id)))]
  const users = new Map(
    (userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : []).map((u) => [u.id, u])
  )
  return {
    rows: rows.map((r) => {
      const buyer = r.createdById ? users.get(r.createdById) : undefined
      return {
        id: r.id,
        orderCode: r.orderCode,
        workspace: { id: r.workspace.id, name: r.workspace.name, slug: r.workspace.slug, deleted: Boolean(r.workspace.deletedAt) },
        buyer: buyer ? { name: buyer.name, email: buyer.email } : null,
        plan: r.plan,
        billing: r.billing,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        paidAt: r.paidAt,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        change: r.change,
        paidAfter: r.paidAfter,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        reviewer: r.reviewedById ? users.get(r.reviewedById)?.email ?? null : null,
        invoice: r.invoice ? { status: r.invoice.status, einvoiceNumber: r.invoice.einvoiceNumber } : null,
      }
    }),
    total,
    page,
    size,
  }
}

/**
 * The figures above the list: money received this month (Vietnam time) and
 * in the last 30 days (by when it was paid), orders paid this month, codes
 * still payable, and flagged orders nobody has looked at.
 */
export async function ordersSummary(now = new Date()) {
  const { start, end } = vietnamMonth(now)
  const db = prismaWithDeleted.subscriptionPayment
  const [month, last30, pending, flagged] = await Promise.all([
    db.aggregate({ where: { status: 'PAID', paidAt: { gte: start, lt: end } }, _sum: { amount: true }, _count: { _all: true } }),
    db.aggregate({ where: { status: 'PAID', paidAt: { gt: new Date(now.getTime() - 30 * DAY_MS), lte: now } }, _sum: { amount: true } }),
    db.count({ where: { status: 'PENDING', expiresAt: { gt: now } } }),
    db.count({ where: { paidAfter: { not: null }, reviewedAt: null } }),
  ])
  return {
    revenueMonth: month._sum.amount ?? 0,
    paidMonth: month._count._all,
    revenue30d: last30._sum.amount ?? 0,
    pending,
    flagged,
  }
}

/** The order an operator acts on (any workspace, deleted ones too), or null. */
export function findOrder(id: string) {
  return prismaWithDeleted.subscriptionPayment.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, orderCode: true, status: true, paidAfter: true, reviewedAt: true },
  })
}

type Order = NonNullable<Awaited<ReturnType<typeof findOrder>>>

const logAction = (tx: Prisma.TransactionClient, action: string, order: Order, admin: PlatformAdmin, note: string | null) =>
  tx.activityLog.create({
    data: {
      userId: admin.id,
      workspaceId: order.workspaceId,
      action,
      entityType: 'SUBSCRIPTION_PAYMENT',
      entityId: order.id,
      metadata: { by: admin.email, orderCode: order.orderCode, note },
    },
  })

/**
 * Cancels a code still waiting: at PayOS first (best effort, like the hotels'
 * cancelPayosPayment), then here if it is still PENDING. `cancelled` is false
 * when it no longer was; `payos` says whether PayOS closed the link (if not,
 * money that comes anyway is applied and flagged).
 */
export async function cancelOrder(order: Order, admin: PlatformAdmin, note: string | null) {
  const notCancelled = await cancelPlanLinks([order.orderCode], OPERATOR_REASON)
  const cancelled = await prisma.$transaction(async (tx) => {
    const marked = await tx.subscriptionPayment.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    if (marked.count === 0) return false
    await logAction(tx, 'PLAN_ORDER_CANCELLED', order, admin, note)
    return true
  })
  return { cancelled, payos: notCancelled.length === 0 }
}

/** Marks a flagged order as looked at, with the operator's note. False when it is not flagged or was already marked. */
export async function reviewOrder(order: Order, admin: PlatformAdmin, note: string) {
  return prisma.$transaction(async (tx) => {
    const marked = await tx.subscriptionPayment.updateMany({
      where: { id: order.id, paidAfter: { not: null }, reviewedAt: null },
      data: { reviewedAt: new Date(), reviewedById: admin.id, reviewNote: note },
    })
    if (marked.count === 0) return false
    await logAction(tx, 'PLAN_ORDER_REVIEWED', order, admin, note)
    return true
  })
}
