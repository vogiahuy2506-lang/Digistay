/**
 * The members' log, like UKNOW's EMPLOYEE_* audit entries: who invited,
 * changed, locked or removed whom, and when. Rows of activity_logs with
 * entityType MEMBER or INVITATION; the members page's Nhật ký tab reads
 * them (GET /api/workspaces/[id]/members/activity).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const MEMBER_ACTIONS = [
  'MEMBER_INVITED',
  'INVITE_RESENT',
  'INVITE_REVOKED',
  'INVITE_ACCEPTED',
  'INVITE_DECLINED',
  'MEMBER_UPDATED',
  'MEMBER_LOCKED',
  'MEMBER_UNLOCKED',
  'MEMBER_REMOVED',
  'MEMBER_LEFT',
] as const
export type MemberAction = (typeof MEMBER_ACTIONS)[number]

type Db = Pick<Prisma.TransactionClient, 'activityLog'>

export function logMemberActivity(
  db: Db,
  entry: {
    workspaceId: string
    /** Who did it: the admin, or the member themselves (accepting, leaving). */
    actorId: string | null
    action: MemberAction
    entityType: 'MEMBER' | 'INVITATION'
    entityId: string
    /** Who it was about, shown in the log: their email and name. */
    subject: { email: string; name?: string | null }
    changes?: Prisma.InputJsonObject
  }
) {
  return db.activityLog.create({
    data: {
      userId: entry.actorId,
      workspaceId: entry.workspaceId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: { email: entry.subject.email, name: entry.subject.name ?? null },
      ...(entry.changes && { changes: entry.changes }),
    },
  })
}

/** The workspace's member log, newest first. */
export async function memberActivity(workspaceId: string, take = 100) {
  const rows = await prisma.activityLog.findMany({
    where: { workspaceId, entityType: { in: ['MEMBER', 'INVITATION'] } },
    orderBy: { createdAt: 'desc' },
    take,
  })
  const actorIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))]
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
  const byId = new Map(actors.map((a) => [a.id, a]))
  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as { email?: string; name?: string | null }
    const actor = r.userId ? byId.get(r.userId) : undefined
    return {
      id: r.id,
      action: r.action,
      at: r.createdAt.toISOString(),
      actor: actor ? { name: actor.name, email: actor.email } : null,
      subject: { email: meta.email ?? '', name: meta.name ?? null },
      changes: r.changes ?? null,
    }
  })
}
