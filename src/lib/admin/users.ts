/**
 * What Digistay's operators do to an account (/admin/customers): find it,
 * lock or unlock it, and turn off its two-factor sign-in when the owner lost
 * both the phone and the recovery codes (docs/RUNBOOK.md, "Đặt lại xác thực
 * hai lớp": the person is verified first, by a call to a number known
 * beforehand or a video call; a staff member through their workspace owner).
 *
 * Each is logged like the operator SQL scripts were: ActivityLog with
 * userId = the operator, entityType USER, metadata.by = their email.
 */
import { Prisma, type Subscription } from '@prisma/client'
import { prisma } from '@/lib/db'
import { revokeSessions } from '@/lib/auth/session-revocation'
import { isPlanId, type PlanId } from '@/lib/marketing/plans'
import { ensureSubscription } from '@/lib/billing/subscription'
import { reconcileOverageSoon } from '@/lib/billing/overage'
import { generateSlug } from '@/lib/utils'
import { defaultWorkspaceName } from '@/lib/auth/default-workspace'
import { planView, MAX_PLAN_YEARS, PLAN_END_INVALID } from './customers'
import type { PlatformAdmin } from './guard'

export const VERIFIED_VIA = ['phone', 'video', 'owner'] as const
export type VerifiedVia = (typeof VERIFIED_VIA)[number]

export class AdminActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'AdminActionError'
  }
}

export const USER_NOT_FOUND = 'Không tìm thấy tài khoản người dùng'
export const NOT_AN_OPERATOR_TARGET = 'Không thao tác được trên tài khoản quản trị Digistay'
export const ALREADY_LOCKED = 'Tài khoản đã bị khoá'
export const NOT_LOCKED = 'Tài khoản không bị khoá'
export const NO_TWO_FACTOR = 'Tài khoản này không bật xác thực hai lớp'

const PAGE_SIZE = 25

/** An account as the operator pages list it. */
export const USER_ROW = {
  id: true,
  name: true,
  email: true,
  username: true,
  phone: true,
  role: true,
  emailVerified: true,
  disabledAt: true,
  disabledReason: true,
  createdAt: true,
  twoFactor: { select: { enabledAt: true } },
  _count: { select: { ownedWorkspaces: true, workspaceMembers: true } },
} satisfies Prisma.UserSelect

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_ROW }> & {
  ownedWorkspaces?: { id: string; subscription: Subscription | null }[]
}

export function userView(user: UserRow, now = new Date()) {
  const { twoFactor, _count, ownedWorkspaces, ...rest } = user
  let plan = null
  if (ownedWorkspaces && ownedWorkspaces.length > 0) {
    const subs = ownedWorkspaces
      .map((w) => w.subscription)
      .filter((s): s is Subscription => Boolean(s))
    if (subs.length > 0) {
      subs.sort((a, b) => {
        if (!a.trial && b.trial) return -1
        if (a.trial && !b.trial) return 1
        return b.periodEnd.getTime() - a.periodEnd.getTime()
      })
      plan = planView(subs[0], now)
    }
  }
  return {
    ...rest,
    twoFactor: !!twoFactor?.enabledAt,
    ownedWorkspaces: _count.ownedWorkspaces,
    memberships: _count.workspaceMembers,
    plan,
  }
}

/** Accounts by email, name, username or phone, newest first; `locked` only the locked ones. */
export async function searchUsers({
  q,
  locked,
  page = 1,
  size = PAGE_SIZE,
  now = new Date(),
}: {
  q?: string
  locked?: boolean
  page?: number
  size?: number
  now?: Date
}) {
  const text = q?.trim()
  const where: Prisma.UserWhereInput = {
    ...(locked && { disabledAt: { not: null } }),
    ...(text && {
      OR: [
        { email: { contains: text, mode: 'insensitive' } },
        { name: { contains: text, mode: 'insensitive' } },
        { username: { contains: text, mode: 'insensitive' } },
        { phone: { contains: text } },
      ],
    }),
  }
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...USER_ROW,
        ownedWorkspaces: {
          where: { deletedAt: null },
          select: {
            id: true,
            subscription: true,
          },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.user.count({ where }),
  ])
  return { rows: rows.map((r) => userView(r, now)), total, page, size }
}

/** The account an operator may act on: it exists and is not an operator itself (nor them). */
async function target(admin: PlatformAdmin, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, disabledAt: true, twoFactor: { select: { enabledAt: true } } },
  })
  if (!user) throw new AdminActionError(USER_NOT_FOUND, 404)
  // Operators are managed with SQL (RUNBOOK): one cannot lock another out from here.
  if (user.role === 'SUPER_ADMIN' || user.id === admin.id) throw new AdminActionError(NOT_AN_OPERATOR_TARGET, 403)
  return user
}

const log = (tx: Prisma.TransactionClient, admin: PlatformAdmin, userId: string, action: string, metadata: Prisma.InputJsonObject) =>
  tx.activityLog.create({
    data: { userId: admin.id, action, entityType: 'USER', entityId: userId, metadata: { by: admin.email, ...metadata } },
  })

/**
 * Locks an account: no sign-in of any kind (password, two-factor, Google:
 * src/lib/auth), and its sessions end (session-revocation.ts). The
 * workspaces it owns go on for their staff.
 */
export async function lockUser(admin: PlatformAdmin, userId: string, reason: string, now = new Date()) {
  const user = await target(admin, userId)
  if (user.disabledAt) throw new AdminActionError(ALREADY_LOCKED, 409)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { disabledAt: now, disabledReason: reason } })
    await log(tx, admin, userId, 'USER_LOCKED', { email: user.email, reason })
  })
  await revokeSessions(userId, now.getTime())
}

export async function unlockUser(admin: PlatformAdmin, userId: string, note: string) {
  const user = await target(admin, userId)
  if (!user.disabledAt) throw new AdminActionError(NOT_LOCKED, 409)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { disabledAt: null, disabledReason: null } })
    await log(tx, admin, userId, 'USER_UNLOCKED', { email: user.email, note })
  })
}

/**
 * Turns two-factor sign-in off (docker/sql/reset-two-factor.sql did this by
 * hand): the person signs in with the password alone and may turn it on
 * again. Logged as TWO_FACTOR_RESET_BY_OPERATOR with how they were verified.
 */
export async function resetTwoFactor(admin: PlatformAdmin, userId: string, verifiedVia: VerifiedVia, note: string) {
  const user = await target(admin, userId)
  // A setup never confirmed (enabledAt null) asks for no code: nothing to reset.
  if (!user.twoFactor?.enabledAt) throw new AdminActionError(NO_TWO_FACTOR, 409)
  await prisma.$transaction(async (tx) => {
    await tx.userTwoFactor.deleteMany({ where: { userId } })
    await log(tx, admin, userId, 'TWO_FACTOR_RESET_BY_OPERATOR', { email: user.email, verifiedVia, note })
  })
}

export interface UserPlanInput {
  plan: PlanId
  trial: boolean
  periodEnd: Date
  note: string
}

/**
 * Assigns a subscription plan to a User:
 * 1. Updates subscriptions across all active workspaces owned by the user.
 * 2. If the user doesn't own any workspace yet, creates their default workspace with this plan.
 * 3. Logs activity at both workspace and user level.
 */
export async function setUserPlan(
  admin: PlatformAdmin,
  userId: string,
  input: UserPlanInput,
  now = new Date(),
) {
  if (!isPlanId(input.plan)) throw new AdminActionError('Gói không hợp lệ')
  const latest = new Date(now.getTime() + MAX_PLAN_YEARS * 365 * 24 * 60 * 60 * 1000)
  if (input.periodEnd.getTime() <= now.getTime() || input.periodEnd.getTime() > latest.getTime()) {
    throw new AdminActionError(PLAN_END_INVALID)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      ownedWorkspaces: {
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
      },
    },
  })
  if (!user) throw new AdminActionError(USER_NOT_FOUND, 404)

  let workspaceIds = user.ownedWorkspaces.map((w) => w.id)

  if (workspaceIds.length === 0) {
    const baseSlug = generateSlug(`${user.username || user.name || 'workspace'}-workspace`) || 'workspace'
    let slug = baseSlug
    let counter = 1
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`
    }
    const created = await prisma.workspace.create({
      data: {
        name: defaultWorkspaceName(user.name || user.email),
        slug,
        ownerId: user.id,
        description: 'Không gian làm việc mặc định',
        subscription: {
          create: {
            plan: input.plan,
            trial: input.trial,
            billing: input.trial ? null : 'MONTH',
            periodStart: now,
            periodEnd: input.periodEnd,
          },
        },
      },
      select: { id: true },
    })
    workspaceIds = [created.id]
  } else {
    for (const wsId of workspaceIds) {
      await prisma.$transaction(async (tx) => {
        const sub = await ensureSubscription(wsId, tx, now)
        const samePlan = sub.plan === input.plan
        const data: Prisma.SubscriptionUpdateInput = {
          plan: input.plan,
          trial: input.trial,
          billing: input.trial ? sub.billing : (sub.billing ?? 'MONTH'),
          periodStart: samePlan ? sub.periodStart : now,
          periodEnd: input.periodEnd,
          reminders: Prisma.DbNull,
        }
        if (sub.nextPlan && sub.nextPeriodEnd) {
          const shift = input.periodEnd.getTime() - sub.periodEnd.getTime()
          const nextEnd = new Date(sub.nextPeriodEnd.getTime() + shift)
          data.nextPeriodEnd = nextEnd
          if (sub.nextPaymentId) {
            await tx.subscriptionPayment.updateMany({
              where: { id: sub.nextPaymentId },
              data: { periodStart: input.periodEnd, periodEnd: nextEnd },
            })
          }
        }
        const updated = await tx.subscription.update({ where: { workspaceId: wsId }, data })
        await tx.activityLog.create({
          data: {
            userId: admin.id,
            workspaceId: wsId,
            action: 'PLAN_SET_BY_OPERATOR',
            entityType: 'SUBSCRIPTION',
            entityId: wsId,
            changes: {
              before: { plan: sub.plan, trial: sub.trial, billing: sub.billing, periodEnd: sub.periodEnd.toISOString() },
              after: { plan: updated.plan, trial: updated.trial, billing: updated.billing, periodEnd: updated.periodEnd.toISOString() },
            },
            metadata: { by: admin.email, note: input.note, targetUserId: user.id },
          },
        })
        return updated
      })
      reconcileOverageSoon(wsId)
    }
  }

  // Log user-level action
  await prisma.activityLog.create({
    data: {
      userId: admin.id,
      action: 'USER_PLAN_SET_BY_OPERATOR',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        by: admin.email,
        userEmail: user.email,
        plan: input.plan,
        trial: input.trial,
        periodEnd: input.periodEnd.toISOString(),
        workspacesCount: workspaceIds.length,
        note: input.note,
      },
    },
  })

  const primarySub = await prisma.subscription.findUnique({ where: { workspaceId: workspaceIds[0] } })
  return planView(primarySub, now)
}
