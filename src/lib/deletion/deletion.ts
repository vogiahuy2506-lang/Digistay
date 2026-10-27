/**
 * The database side of deleting and restoring (the rules are in rules.ts; the
 * routes under /api/properties/[id], /api/workspaces/[id] and
 * /api/internal/purge-deleted do the writes).
 *
 * Who may: the workspace's owner only. Anyone else gets "not found" when they
 * are not in the workspace (or it is deleted) and "forbidden" when they are a
 * member, as for any other record (CLAUDE.md, "Luật bảo mật cho API").
 */
import type { Prisma } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { getAccess } from '@/lib/auth/access'
import { guestsBookedWhere, purgeAt, restoreDaysLeft } from './rules'

type Tx = Prisma.TransactionClient

export type OwnerLookup<T> = { ok: true; row: T } | { ok: false; status: 403 | 404 }

const refuse = async (workspaceId: string, userId: string): Promise<{ ok: false; status: 403 | 404 }> => ({
  ok: false,
  status: (await getAccess(workspaceId, userId)) ? 403 : 404,
})

const propertyFields = { id: true, name: true, subdomain: true, workspaceId: true, deletedAt: true, workspace: { select: { ownerId: true } } } as const
const workspaceFields = { id: true, name: true, slug: true, ownerId: true, deletedAt: true } as const

/** A property that is not deleted, in a workspace that is not, for the workspace's owner. */
export async function livePropertyForOwner(id: string, userId: string) {
  const row = await prisma.property.findUnique({ where: { id }, select: propertyFields })
  if (!row) return { ok: false, status: 404 } as const
  if (row.workspace.ownerId !== userId) return refuse(row.workspaceId, userId)
  return { ok: true, row } as const
}

/** A deleted property of a workspace that is not deleted, for the workspace's owner. */
export async function deletedPropertyForOwner(id: string, userId: string) {
  const row = await prisma.property.findFirst({
    where: { id, deletedAt: { not: null }, workspace: { deletedAt: null } },
    select: propertyFields,
  })
  if (!row?.deletedAt) return { ok: false, status: 404 } as const
  if (row.workspace.ownerId !== userId) return refuse(row.workspaceId, userId)
  return { ok: true, row: { ...row, deletedAt: row.deletedAt } } as const
}

/** A workspace that is not deleted, for its owner. */
export async function liveWorkspaceForOwner(id: string, userId: string) {
  const row = await prisma.workspace.findUnique({ where: { id }, select: workspaceFields })
  if (!row) return { ok: false, status: 404 } as const
  if (row.ownerId !== userId) return refuse(row.id, userId)
  return { ok: true, row } as const
}

/**
 * A deleted workspace, for its owner. Its members no longer see it at all,
 * so for them it is not found, like for anyone else.
 */
export async function deletedWorkspaceForOwner(id: string, userId: string) {
  const row = await prisma.workspace.findFirst({ where: { id, deletedAt: { not: null } }, select: workspaceFields })
  if (!row?.deletedAt || row.ownerId !== userId) return { ok: false, status: 404 } as const
  return { ok: true, row: { ...row, deletedAt: row.deletedAt } } as const
}

/** The bookings that stop deleting a property, or every property of a workspace. */
export function guestsBooked(db: Tx, scope: { propertyId: string } | { workspaceId: string }, now = new Date()) {
  const where: Prisma.BookingWhereInput =
    'propertyId' in scope ? { propertyId: scope.propertyId } : { property: { workspaceId: scope.workspaceId } }
  return db.booking.count({ where: { ...where, ...guestsBookedWhere(now) } })
}

/**
 * Locks the room types of the properties being deleted. Making a booking
 * holds its room type row (lockRoomType, src/lib/bookings/occupancy.ts), so
 * a booking made at the same moment is either counted by guestsBooked, or
 * waits and then fails: its property can no longer be read once deleted.
 */
export async function lockRoomTypes(tx: Tx, scope: { propertyId: string } | { workspaceId: string }) {
  if ('propertyId' in scope) {
    await tx.$queryRaw`SELECT id FROM room_types WHERE "propertyId" = ${scope.propertyId} ORDER BY id FOR UPDATE`
  } else {
    await tx.$queryRaw`
      SELECT rt.id FROM room_types rt JOIN properties p ON p.id = rt."propertyId"
      WHERE p."workspaceId" = ${scope.workspaceId} ORDER BY rt.id FOR UPDATE OF rt`
  }
}

/** A plan payment whose PayOS link can still be paid: money for a workspace about to disappear. */
export async function openPlanPayment(workspaceId: string, now = new Date()) {
  const open = await prisma.subscriptionPayment.count({
    where: { workspaceId, status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  })
  return open > 0
}

/** The rooms a property brings back to the plan's count when restored (its active room types). */
export async function roomsOf(propertyId: string) {
  const { _sum } = await prismaWithDeleted.roomType.aggregate({ where: { propertyId, isActive: true }, _sum: { totalRooms: true } })
  return _sum.totalRooms ?? 0
}

export interface DeletedItem {
  id: string
  name: string
  /** subdomain of a property, slug of a workspace */
  handle: string
  deletedAt: string
  purgeAt: string
  daysLeft: number
}

const deletedItem = (row: { id: string; name: string; deletedAt: Date | null }, handle: string, now: Date): DeletedItem => ({
  id: row.id,
  name: row.name,
  handle,
  deletedAt: row.deletedAt!.toISOString(),
  purgeAt: purgeAt(row.deletedAt!).toISOString(),
  daysLeft: restoreDaysLeft(row.deletedAt!, now),
})

/** A workspace's deleted properties still restorable, newest first ("Đã xoá gần đây" on the workspace home). */
export async function deletedPropertiesOf(workspaceId: string, now = new Date()): Promise<DeletedItem[]> {
  const rows = await prisma.property.findMany({
    where: { workspaceId, deletedAt: { not: null }, workspace: { deletedAt: null } },
    select: { id: true, name: true, subdomain: true, deletedAt: true },
    orderBy: { deletedAt: 'desc' },
  })
  return rows.map((r) => deletedItem(r, r.subdomain, now)).filter((item) => item.daysLeft > 0)
}

/** The deleted workspaces `ownerId` owns, still restorable, newest first ("Đã xoá gần đây" on /workspaces). */
export async function deletedWorkspacesOf(ownerId: string, now = new Date()): Promise<DeletedItem[]> {
  const rows = await prisma.workspace.findMany({
    where: { ownerId, deletedAt: { not: null } },
    select: { id: true, name: true, slug: true, deletedAt: true },
    orderBy: { deletedAt: 'desc' },
  })
  return rows.map((r) => deletedItem(r, r.slug, now)).filter((item) => item.daysLeft > 0)
}
