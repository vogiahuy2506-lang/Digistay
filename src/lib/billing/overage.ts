/**
 * A workspace that uses more than its plan allows (after moving to a smaller
 * plan: a downgrade, or a Growth trial followed by Starter). Decision
 * 2026-10-26, "như UKNOW":
 *
 * 1. Over on properties, rooms or staff while the plan is in force (trial,
 *    active or grace; a read-only workspace waits): a 7-day grace starts
 *    (Subscription.overLimitSince), the owner is emailed once and the
 *    dashboard shows a banner.
 * 2. After the 7 days the excess is locked, newest first, until it fits
 *    (src/lib/billing/overage-plan.ts): properties, whole room types, then
 *    staff (open invitations revoked, then members locked). Nothing is
 *    deleted; the owner is emailed what was locked. Locked things do not
 *    count (limits.ts), so the workspace fits and the grace clears.
 * 3. Whenever there is room again (an upgrade, something deleted or turned
 *    off), locked things are unlocked oldest-locked first while they fit.
 *
 * reconcileOverage does all three for one workspace: the plan jobs call it
 * for every workspace (runOverageJobs, /api/internal/subscription-jobs),
 * and it is called right after a plan payment or switch. Enforcement:
 * guard.ts (property and online booking), create-booking.ts and rooms.ts
 * (room types), rbac.ts (members).
 */
import { after } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendAfterResponse } from '@/lib/email/outbox'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { ensureSubscription, workspacePlan } from './subscription'
import { workspaceUsage } from './limits'
import { queueOverageGrace, queueOverageLocked, type LockedForEmail } from './overage-emails'
import { notifyPlanOwner } from '@/lib/notifications'
import {
  countUsage,
  isEmptyPlan,
  overKinds,
  planLocks,
  planUnlocks,
  withLocks,
  withUnlocks,
  type Holdings,
  type LockPlan,
  type OverageKind,
  type OverageLimits,
  type OverageUsage,
  type UnlockPlan,
} from './overage-plan'

type Tx = Prisma.TransactionClient

export const OVERAGE_GRACE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export const overageLocksAt = (since: Date) => new Date(since.getTime() + OVERAGE_GRACE_DAYS * DAY_MS)

export type OverBy = Partial<Record<OverageKind, { used: number; limit: number }>>

/** The kinds over the limit, with what is used and allowed. */
export function overBy(usage: OverageUsage, limits: OverageLimits): OverBy {
  const over: OverBy = {}
  for (const kind of overKinds(usage, limits)) over[kind] = { used: usage[kind], limit: limits[kind] }
  return over
}

const limitsOf = (plan: OverageLimits): OverageLimits => ({ properties: plan.properties, rooms: plan.rooms, staff: plan.staff })

interface Loaded {
  holdings: Holdings
  names: {
    properties: Map<string, string>
    roomTypes: Map<string, { name: string; propertyId: string; rooms: number }>
    members: Map<string, { name: string | null; email: string }>
    invitations: Map<string, string>
  }
}

/** Everything that counts against the plan, locked or not; the owner left out. */
async function loadHoldings(db: Tx | typeof prisma, workspaceId: string, now: Date): Promise<Loaded> {
  const { ownerId } = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { ownerId: true } })
  const properties = await db.property.findMany({
    where: { workspaceId },
    select: { id: true, name: true, createdAt: true, planLockedAt: true },
  })
  const roomTypes = await db.roomType.findMany({
    where: { property: { workspaceId } },
    select: { id: true, name: true, propertyId: true, createdAt: true, planLockedAt: true, isActive: true, totalRooms: true },
  })
  // A member an admin locked takes no seat (src/lib/billing/limits.ts).
  const members = await db.workspaceMember.findMany({
    where: { workspaceId, userId: { not: ownerId }, disabledAt: null },
    select: { userId: true, joinedAt: true, planLockedAt: true, user: { select: { name: true, email: true } } },
  })
  const invitations = await db.invitation.findMany({
    where: { workspaceId, status: 'PENDING', expiresAt: { gt: now } },
    select: { id: true, email: true, createdAt: true },
  })
  return {
    holdings: {
      properties: properties.map(({ id, createdAt, planLockedAt }) => ({ id, createdAt, planLockedAt })),
      roomTypes: roomTypes.map(({ name: _name, ...rt }) => rt),
      members: members.map(({ userId, joinedAt, planLockedAt }) => ({ userId, joinedAt, planLockedAt })),
      invitations: invitations.map(({ id, createdAt }) => ({ id, createdAt })),
    },
    names: {
      properties: new Map(properties.map((p) => [p.id, p.name])),
      roomTypes: new Map(roomTypes.map((rt) => [rt.id, { name: rt.name, propertyId: rt.propertyId, rooms: rt.totalRooms }])),
      members: new Map(members.map((m) => [m.userId, { name: m.user.name, email: m.user.email }])),
      invitations: new Map(invitations.map((i) => [i.id, i.email])),
    },
  }
}

async function applyLocks(tx: Tx, workspaceId: string, plan: LockPlan, at: Date) {
  // Each update only touches what is still unlocked: a lock keeps its first date.
  if (plan.properties.length) {
    await tx.property.updateMany({ where: { id: { in: plan.properties }, workspaceId, planLockedAt: null }, data: { planLockedAt: at } })
  }
  if (plan.roomTypes.length) {
    await tx.roomType.updateMany({ where: { id: { in: plan.roomTypes }, property: { workspaceId }, planLockedAt: null }, data: { planLockedAt: at } })
  }
  if (plan.invitations.length) {
    // EXPIRED, not REVOKED (an admin cancelling it): to the invitee it ran
    // out, as one past its date does (api/invitations/[token]).
    await tx.invitation.updateMany({ where: { id: { in: plan.invitations }, workspaceId, status: 'PENDING' }, data: { status: 'EXPIRED' } })
  }
  if (plan.members.length) {
    await tx.workspaceMember.updateMany({ where: { workspaceId, userId: { in: plan.members }, planLockedAt: null }, data: { planLockedAt: at } })
  }
}

async function applyUnlocks(tx: Tx, workspaceId: string, plan: UnlockPlan) {
  if (plan.properties.length) {
    await tx.property.updateMany({ where: { id: { in: plan.properties }, workspaceId }, data: { planLockedAt: null } })
  }
  if (plan.roomTypes.length) {
    await tx.roomType.updateMany({ where: { id: { in: plan.roomTypes }, property: { workspaceId } }, data: { planLockedAt: null } })
  }
  if (plan.members.length) {
    await tx.workspaceMember.updateMany({ where: { workspaceId, userId: { in: plan.members } }, data: { planLockedAt: null } })
  }
}

function describeLocks(loaded: Loaded, plan: LockPlan): LockedForEmail {
  const { names } = loaded
  return {
    properties: plan.properties.map((id) => ({ name: names.properties.get(id) ?? id })),
    roomTypes: plan.roomTypes.map((id) => {
      const rt = names.roomTypes.get(id)
      return { name: rt?.name ?? id, propertyName: (rt && names.properties.get(rt.propertyId)) ?? '', rooms: rt?.rooms ?? 0 }
    }),
    members: plan.members.map((id) => names.members.get(id) ?? { name: null, email: id }),
    invitations: plan.invitations.map((id) => ({ email: names.invitations.get(id) ?? id })),
  }
}

export interface OverageOutcome {
  /** The grace started now (and the owner was emailed). */
  started: boolean
  /** The grace ended: the workspace fits again, or it is read-only. */
  cleared: boolean
  locked: LockPlan | null
  unlocked: UnlockPlan | null
}

/**
 * Starts or clears the grace, locks the excess once the grace is over and
 * unlocks what fits again, for one workspace. Safe to call at any time and
 * concurrently (the subscription row is locked for the duration).
 */
export async function reconcileOverage(workspaceId: string, now = new Date()): Promise<OverageOutcome> {
  const { outcome, emailIds, sites } = await prisma.$transaction(async (tx) => {
    const outcome: OverageOutcome = { started: false, cleared: false, locked: null, unlocked: null }
    const emailIds: string[] = []
    const sites = new Set<string>()
    await ensureSubscription(workspaceId, tx, now)
    await tx.$queryRaw`SELECT "workspaceId" FROM subscriptions WHERE "workspaceId" = ${workspaceId} FOR UPDATE`
    const current = await workspacePlan(workspaceId, tx, now)
    const since = current.subscription.overLimitSince

    if (current.state === 'locked') {
      // Read-only: nothing can be reduced, so the grace does not run on. A
      // new period starts it again (with its email) if still over.
      if (since) {
        await tx.subscription.update({ where: { workspaceId }, data: { overLimitSince: null } })
        outcome.cleared = true
      }
      return { outcome, emailIds, sites }
    }

    const limits = limitsOf(current.plan)
    const loaded = await loadHoldings(tx, workspaceId, now)
    let holdings = loaded.holdings
    const touchSites = (plan: { properties: string[]; roomTypes: string[] }) => {
      for (const id of plan.properties) sites.add(id)
      for (const id of plan.roomTypes) {
        const rt = loaded.names.roomTypes.get(id)
        if (rt) sites.add(rt.propertyId)
      }
    }

    if (since && now.getTime() >= overageLocksAt(since).getTime() && overKinds(countUsage(holdings), limits).length) {
      const locks = planLocks(holdings, limits)
      if (!isEmptyPlan(locks)) {
        await applyLocks(tx, workspaceId, locks, now)
        holdings = withLocks(holdings, locks, now)
        outcome.locked = locks
        touchSites(locks)
        const locked = describeLocks(loaded, locks)
        emailIds.push(await queueOverageLocked(workspaceId, { plan: current.planId, locked }, tx))
        await notifyPlanOwner(tx, workspaceId, 'plan_overage', {
          state: 'locked',
          plan: current.planId,
          locked: { properties: locked.properties.length, roomTypes: locked.roomTypes.length, members: locked.members.length },
        })
      }
    }

    const unlocks = planUnlocks(holdings, limits)
    if (!isEmptyPlan(unlocks)) {
      await applyUnlocks(tx, workspaceId, unlocks)
      holdings = withUnlocks(holdings, unlocks)
      outcome.unlocked = unlocks
      touchSites(unlocks)
    }

    const usage = countUsage(holdings)
    const over = overKinds(usage, limits)
    if (over.length && !since) {
      await tx.subscription.update({ where: { workspaceId }, data: { overLimitSince: now } })
      outcome.started = true
      emailIds.push(await queueOverageGrace(workspaceId, { plan: current.planId, over: overBy(usage, limits), locksAt: overageLocksAt(now) }, tx))
      await notifyPlanOwner(tx, workspaceId, 'plan_overage', { state: 'grace', plan: current.planId, over, locksAt: overageLocksAt(now).toISOString() })
    } else if (!over.length && since) {
      await tx.subscription.update({ where: { workspaceId }, data: { overLimitSince: null } })
      outcome.cleared = true
    }
    return { outcome, emailIds, sites }
  })
  sendAfterResponse(emailIds)
  for (const propertyId of sites) invalidatePublicSite(propertyId)
  return outcome
}

/**
 * reconcileOverage after the response, for a route whose change may make
 * room (something deleted or turned off): the locked things come back at
 * once instead of at the next job. Never fails the request.
 */
export function reconcileOverageSoon(workspaceId: string) {
  try {
    after(() => reconcileOverage(workspaceId).then(() => undefined, (error) => console.error('[overage] reconcile failed:', error)))
  } catch {
    // Not in a request (scripts, tests): the plan jobs catch up.
  }
}

const BATCH = 100

/** reconcileOverage for every workspace, in batches; one failure does not stop the rest. */
export async function runOverageJobs(now = new Date()) {
  const summary = { checked: 0, started: 0, locked: 0, unlocked: 0, cleared: 0, failed: 0 }
  let cursor: string | undefined
  for (;;) {
    const batch = await prisma.workspace.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    })
    if (batch.length === 0) break
    for (const { id } of batch) {
      summary.checked++
      try {
        const outcome = await reconcileOverage(id, now)
        if (outcome.started) summary.started++
        if (outcome.locked) summary.locked++
        if (outcome.unlocked) summary.unlocked++
        if (outcome.cleared) summary.cleared++
      } catch (error) {
        summary.failed++
        console.error('[overage] reconcile failed for workspace', id, error)
      }
    }
    if (batch.length < BATCH) break
    cursor = batch[batch.length - 1].id
  }
  return summary
}

export interface OverageView {
  /** When the workspace went over (ISO), null when it fits. */
  since: string | null
  /** When the excess locks if still over (ISO). */
  locksAt: string | null
  over: OverBy
  locked: {
    properties: { id: string; name: string }[]
    roomTypes: { id: string; name: string; propertyName: string; rooms: number }[]
    members: { userId: string; name: string | null; email: string }[]
  }
}

/** For the plan page: what is over, since when, and what is locked now. */
export async function overageView(workspaceId: string, now = new Date()): Promise<OverageView> {
  const current = await workspacePlan(workspaceId, prisma, now)
  const since = current.subscription.overLimitSince
  const [usage, properties, roomTypes, members] = await Promise.all([
    workspaceUsage(workspaceId, prisma, now),
    prisma.property.findMany({
      where: { workspaceId, planLockedAt: { not: null } },
      orderBy: [{ planLockedAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.roomType.findMany({
      where: { planLockedAt: { not: null }, property: { workspaceId } },
      orderBy: [{ planLockedAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, totalRooms: true, property: { select: { name: true } } },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, planLockedAt: { not: null } },
      orderBy: [{ planLockedAt: 'asc' }, { joinedAt: 'asc' }],
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
  ])
  return {
    since: since?.toISOString() ?? null,
    locksAt: since ? overageLocksAt(since).toISOString() : null,
    over: overBy(usage, limitsOf(current.plan)),
    locked: {
      properties,
      roomTypes: roomTypes.map((rt) => ({ id: rt.id, name: rt.name, propertyName: rt.property.name, rooms: rt.totalRooms })),
      members: members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email })),
    },
  }
}

export interface OverageBanner {
  /** Over and in the grace: when it locks (ISO). */
  locksAt: string | null
  over: OverageKind[]
  locked: { properties: number; roomTypes: number; members: number }
}

/**
 * The dashboard banner's few facts (src/components/layout/plan-banner.tsx),
 * or null when there is nothing to say: three counts, plus the usage only
 * while a grace runs.
 */
export async function overageBanner(workspaceId: string, overLimitSince: Date | null, limits: OverageLimits): Promise<OverageBanner | null> {
  const [properties, roomTypes, members, usage] = await Promise.all([
    prisma.property.count({ where: { workspaceId, planLockedAt: { not: null } } }),
    prisma.roomType.count({ where: { planLockedAt: { not: null }, property: { workspaceId, planLockedAt: null } } }),
    prisma.workspaceMember.count({ where: { workspaceId, planLockedAt: { not: null } } }),
    overLimitSince ? workspaceUsage(workspaceId) : null,
  ])
  const over = usage ? overKinds(usage, limits) : []
  if (!properties && !roomTypes && !members && !over.length) return null
  return {
    locksAt: overLimitSince && over.length ? overageLocksAt(overLimitSince).toISOString() : null,
    over,
    locked: { properties, roomTypes, members },
  }
}
