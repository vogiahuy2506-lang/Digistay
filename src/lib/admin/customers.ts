/**
 * Digistay's customers, for its operators (/admin/customers): every
 * workspace with its plan, where that stands (period.ts subscriptionState)
 * and what it uses against the plan's limits (limits.ts); one in detail with
 * its people, properties and plan orders; and setting a plan by hand (a
 * gift, a longer trial, days made up after an outage), logged with who did
 * it and why.
 */
import { Prisma, type Subscription } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { GRACE_DAYS, subscriptionState, type SubscriptionStateName } from '@/lib/billing/period'
import { ensureSubscription } from '@/lib/billing/subscription'
import { workspaceUsage } from '@/lib/billing/limits'
import { reconcileOverageSoon } from '@/lib/billing/overage'
import { isPlanId, planById, type PlanId } from '@/lib/marketing/plans'
import { USER_ROW, userView, AdminActionError } from './users'
import type { PlatformAdmin } from './guard'

const DAY_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 25
/** How far ahead a plan may be set by hand. */
export const MAX_PLAN_YEARS = 3

export const CUSTOMER_STATES = ['trial', 'active', 'grace', 'locked'] as const satisfies readonly SubscriptionStateName[]

export const WORKSPACE_NOT_FOUND = 'Không tìm thấy workspace'
export const PLAN_END_INVALID = `Ngày hết hạn phải sau hôm nay và trong vòng ${MAX_PLAN_YEARS} năm`

/** The workspaces in `state` now (period.ts subscriptionState, as a query). One without a row yet is on its trial. */
function stateWhere(state: SubscriptionStateName, now: Date): Prisma.WorkspaceWhereInput {
  const graceEnd = new Date(now.getTime() - GRACE_DAYS * DAY_MS)
  switch (state) {
    case 'trial':
      return { OR: [{ subscription: { is: { trial: true, periodEnd: { gt: now } } } }, { subscription: { is: null } }] }
    case 'active':
      return { subscription: { is: { trial: false, periodEnd: { gt: now } } } }
    case 'grace':
      return { subscription: { is: { periodEnd: { lte: now, gt: graceEnd } } } }
    case 'locked':
      return { subscription: { is: { periodEnd: { lte: graceEnd } } } }
  }
}

function planView(sub: Subscription | null, now: Date) {
  if (!sub) return null
  const state = subscriptionState(sub, now)
  return {
    plan: sub.plan,
    billing: sub.billing,
    trial: sub.trial,
    periodStart: sub.periodStart,
    periodEnd: sub.periodEnd,
    nextPlan: sub.nextPlan,
    nextBilling: sub.nextBilling,
    nextPeriodEnd: sub.nextPeriodEnd,
    overLimitSince: sub.overLimitSince,
    state: state.state,
    daysLeft: state.daysLeft,
    locksAt: state.locksAt,
  }
}

const limitsOf = (plan: string | undefined) => {
  const p = planById(plan ?? 'growth')
  return { properties: p.properties, rooms: p.rooms, staff: p.staff, invoices: p.invoices }
}

/** Workspaces by name, short name or owner, newest first, with their plan and usage. */
export async function listCustomers({
  q,
  state,
  page = 1,
  size = PAGE_SIZE,
  now = new Date(),
}: { q?: string; state?: SubscriptionStateName; page?: number; size?: number; now?: Date }) {
  const text = q?.trim()
  const where: Prisma.WorkspaceWhereInput = {
    AND: [
      text
        ? {
            OR: [
              { name: { contains: text, mode: 'insensitive' } },
              { slug: { contains: text, mode: 'insensitive' } },
              { owner: { email: { contains: text, mode: 'insensitive' } } },
              { owner: { name: { contains: text, mode: 'insensitive' } } },
            ],
          }
        : {},
      state ? stateWhere(state, now) : {},
    ],
  }
  const [workspaces, total] = await Promise.all([
    prisma.workspace.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true, disabledAt: true } },
        subscription: true,
      },
    }),
    prisma.workspace.count({ where }),
  ])
  const usages = await Promise.all(workspaces.map((w) => workspaceUsage(w.id, prisma, now)))
  const rows = workspaces.map(({ subscription, ...w }, i) => ({
    ...w,
    plan: planView(subscription, now),
    usage: usages[i],
    limits: limitsOf(subscription?.plan),
  }))
  return { rows, total, page, size }
}

/** The figures above the list: workspaces by state, accounts, new ones. */
export async function customersSummary(now = new Date()) {
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS)
  const [workspaces, subs, users, lockedUsers, newWorkspaces] = await Promise.all([
    prisma.workspace.count(),
    prisma.subscription.findMany({ where: { workspace: { deletedAt: null } }, select: { trial: true, periodEnd: true, plan: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { disabledAt: { not: null } } }),
    prisma.workspace.count({ where: { createdAt: { gte: monthAgo } } }),
  ])
  const byState: Record<SubscriptionStateName, number> = { trial: 0, active: 0, grace: 0, locked: 0 }
  const paidByPlan: Record<string, number> = {}
  for (const sub of subs) {
    const { state } = subscriptionState(sub, now)
    byState[state]++
    if (state === 'active') paidByPlan[sub.plan] = (paidByPlan[sub.plan] ?? 0) + 1
  }
  // Workspaces whose row is made on first read are on their trial.
  byState.trial += Math.max(0, workspaces - subs.length)
  return { workspaces, byState, paidByPlan, users, lockedUsers, newWorkspaces }
}

/** One workspace for its detail page; a deleted one too (said so), for support. */
export async function customerDetail(workspaceId: string, now = new Date()) {
  const workspace = await prismaWithDeleted.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      deletedAt: true,
      ownerId: true,
      owner: { select: USER_ROW },
      subscription: true,
      members: {
        orderBy: { joinedAt: 'asc' },
        select: { id: true, role: true, joinedAt: true, disabledAt: true, planLockedAt: true, user: { select: USER_ROW } },
      },
      properties: {
        orderBy: { createdAt: 'asc' },
        // Rooms as the plan counts them (limits.ts): those of the active room types.
        select: { id: true, name: true, slug: true, createdAt: true, deletedAt: true, planLockedAt: true, roomTypes: { where: { isActive: true }, select: { totalRooms: true } } },
      },
    },
  })
  if (!workspace) return null
  const [usage, payments, invitations] = await Promise.all([
    workspaceUsage(workspaceId, prisma, now),
    prismaWithDeleted.subscriptionPayment.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, orderCode: true, plan: true, billing: true, amount: true, status: true, createdAt: true, paidAt: true, periodStart: true, periodEnd: true, change: true, paidAfter: true },
    }),
    prismaWithDeleted.invitation.count({ where: { workspaceId, status: 'PENDING', expiresAt: { gt: now } } }),
  ])
  const { owner, members, subscription, properties, ...rest } = workspace
  return {
    ...rest,
    properties: properties.map(({ roomTypes, ...p }) => ({ ...p, rooms: roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0) })),
    owner: userView(owner),
    // The owner is not a member row; staff are.
    members: members
      .filter((m) => m.user.id !== workspace.ownerId)
      .map(({ user, ...m }) => ({ ...m, user: userView(user) })),
    plan: planView(subscription, now),
    usage,
    limits: limitsOf(subscription?.plan),
    payments,
    openInvitations: invitations,
  }
}

export interface PlanInput {
  plan: PlanId
  /** Still a trial (a longer one), or a plan given without payment. */
  trial: boolean
  periodEnd: Date
  note: string
}

/**
 * Sets a workspace's plan and its end by hand. Same plan: its period goes
 * on (start kept); another: a period from now. A paid downgrade waiting
 * (Subscription.next*) still starts at the end, moved with it, as when a
 * payment moves the end (checkout.ts). Bigger limits unlock what was locked
 * over the old ones at once (overage.ts).
 */
export async function setPlan(admin: PlatformAdmin, workspaceId: string, input: PlanInput, now = new Date()) {
  if (!isPlanId(input.plan)) throw new AdminActionError('Gói không hợp lệ')
  const latest = new Date(now.getTime() + MAX_PLAN_YEARS * 365 * DAY_MS)
  if (input.periodEnd.getTime() <= now.getTime() || input.periodEnd.getTime() > latest.getTime()) {
    throw new AdminActionError(PLAN_END_INVALID)
  }
  if (!(await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } }))) {
    throw new AdminActionError(WORKSPACE_NOT_FOUND, 404)
  }

  const after = await prisma.$transaction(async (tx) => {
    const sub = await ensureSubscription(workspaceId, tx, now)
    const samePlan = sub.plan === input.plan
    const data: Prisma.SubscriptionUpdateInput = {
      plan: input.plan,
      trial: input.trial,
      // A trial has no billing period; a plan given keeps the one it had, else monthly.
      billing: input.trial ? sub.billing : (sub.billing ?? 'MONTH'),
      periodStart: samePlan ? sub.periodStart : now,
      periodEnd: input.periodEnd,
      // The reminders were for the old end.
      reminders: Prisma.DbNull,
    }
    if (sub.nextPlan && sub.nextPeriodEnd) {
      const shift = input.periodEnd.getTime() - sub.periodEnd.getTime()
      const nextEnd = new Date(sub.nextPeriodEnd.getTime() + shift)
      data.nextPeriodEnd = nextEnd
      if (sub.nextPaymentId) {
        await tx.subscriptionPayment.updateMany({ where: { id: sub.nextPaymentId }, data: { periodStart: input.periodEnd, periodEnd: nextEnd } })
      }
    }
    const updated = await tx.subscription.update({ where: { workspaceId }, data })
    await tx.activityLog.create({
      data: {
        userId: admin.id,
        workspaceId,
        action: 'PLAN_SET_BY_OPERATOR',
        entityType: 'SUBSCRIPTION',
        entityId: workspaceId,
        changes: {
          before: { plan: sub.plan, trial: sub.trial, billing: sub.billing, periodEnd: sub.periodEnd.toISOString() },
          after: { plan: updated.plan, trial: updated.trial, billing: updated.billing, periodEnd: updated.periodEnd.toISOString() },
        },
        metadata: { by: admin.email, note: input.note },
      },
    })
    return updated
  })
  reconcileOverageSoon(workspaceId)
  return planView(after, now)
}
