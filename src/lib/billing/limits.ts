/**
 * What a workspace uses against its plan's limits (src/lib/marketing/plans.ts):
 * properties, rooms, staff accounts and e-invoices issued this month.
 *
 * - Rooms: the rooms of the active room types (RoomType.totalRooms, which
 *   follows the active Room rows once a type has any).
 * - Staff: the members other than the owner, plus invitations still open
 *   (an invitation is a seat being taken).
 * - E-invoices: published this calendar month, Vietnam time.
 *
 * What is locked for being over the plan (src/lib/billing/overage.ts) does
 * not count: a locked property (and its rooms), a locked room type's rooms,
 * a locked member. Nor does a member an admin locked (disabledAt): unlocking
 * them takes a seat again.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { workspacePlan } from './subscription'
import { planToFit, type PlanLimitFacts } from './plan-fit'

type Db = PrismaClient | Prisma.TransactionClient

export type LimitKind = 'properties' | 'rooms' | 'staff' | 'invoices'

export interface Usage {
  properties: number
  rooms: number
  staff: number
  invoices: number
}

/** The first instant of this month and of the next, in Vietnam time (UTC+7, no DST). */
export function vietnamMonth(now = new Date()): { start: Date; end: Date } {
  const vn = new Date(now.getTime() + 7 * 3600_000)
  const start = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - 7 * 3600_000)
  const end = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() + 1, 1) - 7 * 3600_000)
  return { start, end }
}

export async function workspaceUsage(workspaceId: string, db: Db = prisma, now = new Date()): Promise<Usage> {
  const { start, end } = vietnamMonth(now)
  const [workspace, properties, rooms, members, invitations, invoices] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } }),
    db.property.count({ where: { workspaceId, planLockedAt: null } }),
    db.roomType.aggregate({
      where: { isActive: true, planLockedAt: null, property: { workspaceId, planLockedAt: null } },
      _sum: { totalRooms: true },
    }),
    db.workspaceMember.findMany({ where: { workspaceId, planLockedAt: null, disabledAt: null }, select: { userId: true } }),
    db.invitation.count({ where: { workspaceId, status: 'PENDING', expiresAt: { gt: now } } }),
    db.invoice.count({ where: { property: { workspaceId }, publishedAt: { gte: start, lt: end } } }),
  ])
  const staff = members.filter((m) => m.userId !== workspace?.ownerId).length + invitations
  return { properties, rooms: rooms._sum.totalRooms ?? 0, staff, invoices }
}

const MESSAGES: Record<LimitKind, (limit: number) => string> = {
  properties: (n) => `Gói hiện tại cho phép tối đa ${n} cơ sở. Nâng cấp gói trong Gói & thanh toán để thêm.`,
  rooms: (n) => `Gói hiện tại cho phép tối đa ${n} phòng. Nâng cấp gói trong Gói & thanh toán để thêm.`,
  staff: (n) => `Gói hiện tại cho phép tối đa ${n} tài khoản nhân viên. Nâng cấp gói trong Gói & thanh toán để mời thêm.`,
  invoices: (n) => `Gói hiện tại cho phép phát hành tối đa ${n} hoá đơn điện tử mỗi tháng. Nâng cấp gói trong Gói & thanh toán để phát hành thêm.`,
}

export const NO_INVOICES_IN_PLAN = 'Gói hiện tại không gồm hoá đơn điện tử. Nâng cấp gói trong Gói & thanh toán để phát hành hoá đơn.'

/** A change the plan refuses: the message for the page, and the facts behind it (plan-fit.ts). */
export interface PlanLimitRefusal {
  message: string
  facts: PlanLimitFacts
}

/**
 * Why adding `adding` more of `kind` would pass the plan's limit, with what
 * is used, the limit and the plan that would fit; null when it fits.
 * `adding` may be 0 or negative (a change that does not grow the count
 * always fits).
 */
export async function planLimitRefusal(workspaceId: string, kind: LimitKind, adding: number, db: Db = prisma): Promise<PlanLimitRefusal | null> {
  if (adding <= 0) return null
  const [{ plan, planId }, usage] = await Promise.all([workspacePlan(workspaceId, db), workspaceUsage(workspaceId, db)])
  const limit = plan[kind]
  if (usage[kind] + adding <= limit) return null
  return {
    message: kind === 'invoices' && limit === 0 ? NO_INVOICES_IN_PLAN : MESSAGES[kind](limit),
    facts: { kind, used: usage[kind], limit, adding, plan: planId, suggested: planToFit(usage, kind, adding) },
  }
}

/** The message of planLimitRefusal alone, or null when the change fits. */
export async function planLimitProblem(workspaceId: string, kind: LimitKind, adding: number, db: Db = prisma): Promise<string | null> {
  return (await planLimitRefusal(workspaceId, kind, adding, db))?.message ?? null
}

/**
 * How many rooms a room type change adds to the workspace's count (negative
 * when it removes some). A type locked for being over the plan counts for
 * nothing either way: its rooms are checked when it is unlocked.
 */
export function roomTypeDelta(
  current: { isActive: boolean; totalRooms: number; planLockedAt?: Date | null },
  next: { isActive?: boolean; totalRooms?: number },
): number {
  if (current.planLockedAt) return 0
  const before = current.isActive ? current.totalRooms : 0
  const after = (next.isActive ?? current.isActive) ? (next.totalRooms ?? current.totalRooms) : 0
  return after - before
}
