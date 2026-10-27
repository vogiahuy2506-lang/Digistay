/**
 * The platform's activity log for Digistay's operators (/admin/activity):
 * every row of activity_logs across workspaces, newest first, with who did
 * it, in which workspace and hotel, and what. "Who deleted this booking?"
 * is answered here instead of with SQL. GET /api/admin/activity reads it.
 *
 * Many rows carry only a propertyId (bookings, payments, invoices), so the
 * workspace a row is shown in and filtered by is its own or its hotel's.
 * Deleted workspaces and hotels keep their names (prismaWithDeleted); purged
 * ones are gone from the database, and their PURGE row's recorded name shows.
 */
import type { Prisma } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'

export const ACTIVITY_PAGE_SIZE = 50
/** How many matching users, workspaces or hotels a search looks at. */
const SEARCH_LIMIT = 200
const DAY_MS = 24 * 60 * 60 * 1000
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export interface ActivityFilter {
  /** An id (of the entity, actor, workspace or hotel), an actor's email or name, a workspace's name or slug, a hotel's name, or a booking code. */
  q?: string
  action?: string
  entityType?: string
  workspaceId?: string
  /** What the user did, and what was done to their account (entity USER). */
  userId?: string
  /** First and last day shown (YYYY-MM-DD, Vietnam time), both included. */
  from?: string
  to?: string
  /** nextCursor of the page before. */
  cursor?: string
  size?: number
}

export interface ActivityRow {
  id: string
  createdAt: string
  action: string
  entityType: string
  entityId: string
  /** Null for the system (jobs, webhooks) and guests. A removed account keeps its id only. */
  actor: { id: string; name: string | null; email: string | null } | null
  /** Name null: purged, and the row did not record it. */
  workspace: { id: string; name: string | null; slug: string | null; deleted: boolean } | null
  property: { id: string; name: string | null; deleted: boolean } | null
  changes: Prisma.JsonValue | null
  metadata: Prisma.JsonValue | null
  ipAddress: string | null
  userAgent: string | null
}

/** Where the next page starts: the last row shown, as base64url "createdAt|id". */
export function encodeActivityCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url')
}

/** The cursor's row, or null when it isn't one encodeActivityCursor made. */
export function decodeActivityCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [iso, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
  if (rest.length || !id || !/^[\w-]{1,64}$/.test(id)) return null
  const createdAt = new Date(iso)
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== iso) return null
  return { createdAt, id }
}

/** Midnight in Vietnam (UTC+7) starting `day` (YYYY-MM-DD), or null when there is no such day. */
export function vietnamMidnight(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  const utc = new Date(Date.UTC(y, mo, d))
  // Date.UTC rolls 2026-02-30 over to March: not a day.
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo || utc.getUTCDate() !== d) return null
  return new Date(utc.getTime() - VN_OFFSET_MS)
}

const unique = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => !!id))]
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The rows of these workspaces: their own, the ones about them, and their hotels'. */
async function workspaceRows(ids: string[]): Promise<Prisma.ActivityLogWhereInput[]> {
  const properties = await prismaWithDeleted.property.findMany({ where: { workspaceId: { in: ids } }, select: { id: true } })
  return [
    { workspaceId: { in: ids } },
    { entityType: 'WORKSPACE', entityId: { in: ids } },
    ...(properties.length ? [{ propertyId: { in: properties.map((p) => p.id) } }] : []),
  ]
}

/** What the search box matches, any of them. */
async function searchRows(q: string): Promise<Prisma.ActivityLogWhereInput[]> {
  const contains = { contains: q, mode: 'insensitive' as const }
  const [users, workspaces, properties, bookings] = await Promise.all([
    prisma.user.findMany({ where: { OR: [{ email: contains }, { name: contains }] }, select: { id: true }, take: SEARCH_LIMIT }),
    prismaWithDeleted.workspace.findMany({ where: { OR: [{ name: contains }, { slug: contains }] }, select: { id: true }, take: SEARCH_LIMIT }),
    prismaWithDeleted.property.findMany({ where: { name: contains }, select: { id: true }, take: SEARCH_LIMIT }),
    prismaWithDeleted.booking.findMany({
      where: { bookingCode: { equals: q, mode: 'insensitive' } },
      select: { id: true, payments: { select: { id: true } }, invoices: { select: { id: true } } },
      take: 5,
    }),
  ])
  // Any id pasted from somewhere: the thing itself, or who / where.
  const or: Prisma.ActivityLogWhereInput[] = [{ entityId: q }, { userId: q }, { workspaceId: q }, { propertyId: q }]
  if (users.length) or.push({ userId: { in: users.map((u) => u.id) } })
  if (workspaces.length) or.push(...(await workspaceRows(workspaces.map((w) => w.id))))
  if (properties.length) {
    const ids = properties.map((p) => p.id)
    or.push({ propertyId: { in: ids } }, { entityType: 'PROPERTY', entityId: { in: ids } })
  }
  // A booking code: the booking's rows, and its payments' and invoices'.
  if (bookings.length) {
    or.push({ entityType: 'BOOKING', entityId: { in: bookings.map((b) => b.id) } })
    const payments = bookings.flatMap((b) => b.payments.map((p) => p.id))
    const invoices = bookings.flatMap((b) => b.invoices.map((i) => i.id))
    if (payments.length) or.push({ entityType: 'PAYMENT', entityId: { in: payments } })
    if (invoices.length) or.push({ entityType: 'INVOICE', entityId: { in: invoices } })
  }
  return or
}

async function filterWhere(filter: ActivityFilter): Promise<Prisma.ActivityLogWhereInput[]> {
  const and: Prisma.ActivityLogWhereInput[] = []
  if (filter.action) and.push({ action: filter.action })
  if (filter.entityType) and.push({ entityType: filter.entityType })
  if (filter.workspaceId) and.push({ OR: await workspaceRows([filter.workspaceId]) })
  if (filter.userId) and.push({ OR: [{ userId: filter.userId }, { entityType: 'USER', entityId: filter.userId }] })
  const from = filter.from ? vietnamMidnight(filter.from) : null
  const to = filter.to ? vietnamMidnight(filter.to) : null
  if (from) and.push({ createdAt: { gte: from } })
  if (to) and.push({ createdAt: { lt: new Date(to.getTime() + DAY_MS) } })
  const q = filter.q?.trim()
  if (q) and.push({ OR: await searchRows(q) })
  return and
}

/**
 * One page of the log, newest first: `size` rows and the cursor of the next
 * page (null on the last one). No total: the table only grows, and counting
 * it for every page is not worth it.
 */
export async function listActivity(filter: ActivityFilter = {}): Promise<{ rows: ActivityRow[]; nextCursor: string | null }> {
  const size = Math.min(Math.max(Math.trunc(filter.size ?? ACTIVITY_PAGE_SIZE), 1), 200)
  const after = filter.cursor ? decodeActivityCursor(filter.cursor) : null
  if (filter.cursor && !after) throw new Error('Invalid activity cursor')
  const and = await filterWhere(filter)
  // (createdAt, id) after the last row shown: rows written in the same millisecond are neither skipped nor repeated.
  if (after) and.push({ OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] })

  const found = await prisma.activityLog.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: size + 1,
  })
  const page = found.slice(0, size)
  return {
    rows: await describe(page),
    nextCursor: found.length > size ? encodeActivityCursor(page[page.length - 1]) : null,
  }
}

type LogRow = Prisma.ActivityLogGetPayload<object>

/** The rows with their actor, workspace and hotel looked up. */
async function describe(rows: LogRow[]): Promise<ActivityRow[]> {
  const workspaceOf = (r: LogRow) => r.workspaceId ?? (r.entityType === 'WORKSPACE' ? r.entityId : null)
  const propertyOf = (r: LogRow) => r.propertyId ?? (r.entityType === 'PROPERTY' ? r.entityId : null)

  const [users, properties] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: unique(rows.map((r) => r.userId)) } }, select: { id: true, name: true, email: true } }),
    prismaWithDeleted.property.findMany({
      where: { id: { in: unique(rows.map(propertyOf)) } },
      select: { id: true, name: true, workspaceId: true, deletedAt: true },
    }),
  ])
  const workspaces = await prismaWithDeleted.workspace.findMany({
    where: { id: { in: unique([...rows.map(workspaceOf), ...properties.map((p) => p.workspaceId)]) } },
    select: { id: true, name: true, slug: true, deletedAt: true },
  })
  const userById = new Map(users.map((u) => [u.id, u]))
  const propertyById = new Map(properties.map((p) => [p.id, p]))
  const workspaceById = new Map(workspaces.map((w) => [w.id, w]))

  return rows.map((r) => {
    const meta = isObject(r.metadata) ? r.metadata : {}
    // Gone for good (purged): the name the row about it recorded, if it is that row.
    const recorded = (type: string, id: string) => (r.entityType === type && r.entityId === id && typeof meta.name === 'string' ? meta.name : null)
    const propertyId = propertyOf(r)
    const property = propertyId ? propertyById.get(propertyId) : undefined
    const workspaceId = workspaceOf(r) ?? property?.workspaceId ?? null
    const workspace = workspaceId ? workspaceById.get(workspaceId) : undefined
    const user = r.userId ? userById.get(r.userId) : undefined
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.userId ? { id: r.userId, name: user?.name ?? null, email: user?.email ?? null } : null,
      workspace: workspaceId
        ? workspace
          ? { id: workspace.id, name: workspace.name, slug: workspace.slug, deleted: workspace.deletedAt !== null }
          : { id: workspaceId, name: recorded('WORKSPACE', workspaceId), slug: null, deleted: true }
        : null,
      property: propertyId
        ? property
          ? { id: property.id, name: property.name, deleted: property.deletedAt !== null }
          : { id: propertyId, name: recorded('PROPERTY', propertyId), deleted: true }
        : null,
      changes: r.changes ?? null,
      metadata: r.metadata ?? null,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
    }
  })
}

/** The actions and entity types the log holds, for the filters' choices. */
export async function activityFacets(): Promise<{ actions: string[]; entityTypes: string[] }> {
  const [actions, entityTypes] = await Promise.all([
    prisma.activityLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
    prisma.activityLog.groupBy({ by: ['entityType'], orderBy: { entityType: 'asc' } }),
  ])
  return { actions: actions.map((a) => a.action), entityTypes: entityTypes.map((e) => e.entityType) }
}

/** The workspace and user a link narrowed the log to, for the page's chips (null: no longer there). */
export async function activityScope({ workspaceId, userId }: { workspaceId?: string; userId?: string }) {
  const [workspace, user] = await Promise.all([
    workspaceId
      ? prismaWithDeleted.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, deletedAt: true } })
      : null,
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }) : null,
  ])
  return {
    workspace: workspace ? { id: workspace.id, name: workspace.name, deleted: workspace.deletedAt !== null } : null,
    user,
  }
}
