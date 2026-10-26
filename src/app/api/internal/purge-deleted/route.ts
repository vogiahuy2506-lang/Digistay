import { NextRequest, NextResponse } from 'next/server'
import { prismaWithDeleted } from '@/lib/db'
import { checkCronSecret } from '@/lib/security/cron-secret'
import { recordJobRun } from '@/lib/ops/job-runs'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { purgeCutoff } from '@/lib/deletion/rules'

/** Properties and workspaces removed per run; the rest wait 10 minutes. */
const PER_RUN = 20
/** The slug of a purged workspace kept for its plan payments (purgeWorkspace). */
const KEPT_PREFIX = 'purged-'

interface PurgeSummary {
  properties: number
  workspaces: number
  /** the purged properties, whose cached sites are dropped */
  propertyIds: string[]
}

/**
 * POST /api/internal/purge-deleted — removes for good the properties and
 * workspaces deleted more than 30 days ago (src/lib/deletion), every 10
 * minutes with the other jobs (docker/systemd/scheduled-jobs.sh): one
 * transaction per property, then one per workspace once its properties are
 * gone. Their subdomains, slugs and custom domains are free from then on.
 * Fails (and so alerts) when one could not be removed. CRON_SECRET header;
 * nginx does not route /api/internal/.
 */
export async function POST(request: NextRequest) {
  const refused = checkCronSecret(request)
  if (refused) return refused

  const summary = await recordJobRun('purge-deleted', () => purgeDeleted())
  // Hidden since the deletion; nothing of them may stay cached.
  for (const id of summary.propertyIds) invalidatePublicSite(id)
  console.log(`[deletion] purge ${JSON.stringify({ properties: summary.properties, workspaces: summary.workspaces })}`)
  return NextResponse.json({ success: true, data: summary })
}

async function purgeDeleted(now = new Date()): Promise<PurgeSummary> {
  const cutoff = purgeCutoff(now)
  const summary: PurgeSummary = { properties: 0, workspaces: 0, propertyIds: [] }
  const failures: string[] = []

  const purge = async (label: string, run: () => Promise<boolean>) => {
    try {
      return await run()
    } catch (error) {
      console.error(`[deletion] purge of ${label} failed:`, error)
      failures.push(`${label}: ${String((error as Error)?.message ?? error).slice(0, 200)}`)
      return false
    }
  }

  // Properties deleted on their own.
  const properties = await prismaWithDeleted.property.findMany({
    where: { deletedAt: { lt: cutoff } },
    orderBy: { deletedAt: 'asc' },
    take: PER_RUN,
    select: { id: true },
  })
  for (const { id } of properties) {
    if (await purge(`property ${id}`, () => purgeProperty(id, cutoff, null))) {
      summary.properties++
      summary.propertyIds.push(id)
    }
  }

  // Workspaces: all their properties first, then the workspace.
  const workspaces = await prismaWithDeleted.workspace.findMany({
    // Not the emptied rows kept for Digistay's sales records (purgeWorkspace).
    where: { deletedAt: { lt: cutoff }, NOT: { slug: { startsWith: KEPT_PREFIX } } },
    orderBy: { deletedAt: 'asc' },
    take: PER_RUN,
    select: { id: true },
  })
  for (const { id: workspaceId } of workspaces) {
    const inside = await prismaWithDeleted.property.findMany({ where: { workspaceId }, select: { id: true } })
    let left = inside.length
    for (const { id } of inside) {
      if (await purge(`property ${id}`, () => purgeProperty(id, cutoff, workspaceId))) {
        summary.properties++
        summary.propertyIds.push(id)
        left--
      }
    }
    if (left === 0 && (await purge(`workspace ${workspaceId}`, () => purgeWorkspace(workspaceId, cutoff)))) summary.workspaces++
  }

  if (failures.length) throw new Error(`purge failed for ${failures.length}: ${failures.join(' | ')}`)
  return summary
}

/**
 * One property and everything of it. Its rows that do not cascade go first:
 * invoices (they hold their bookings), payments, bookings (their items,
 * room segments and payments cascade). The property's own rows cascade from
 * it: room types and rooms, photos, website, prices, policy, services, menu,
 * bank accounts, PayOS and Mắt Bão settings, room locks, daily revenue.
 * Its activity log and bell notices go too, except the record of its
 * deletion; one PURGE entry says it is gone.
 *
 * `workspaceId`: purged with its deleted workspace (then the property itself
 * need not be deleted); else it must still be deleted on its own before
 * `cutoff`, checked under the row lock so a restore and the purge cannot both win.
 */
async function purgeProperty(id: string, cutoff: Date, workspaceId: string | null): Promise<boolean> {
  return prismaWithDeleted.$transaction(
    async (tx) => {
      if (workspaceId) {
        const [workspace] = await tx.$queryRaw<{ deletedAt: Date | null }[]>`
          SELECT "deletedAt" FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`
        if (!workspace?.deletedAt || workspace.deletedAt >= cutoff) return false
      }
      const [row] = await tx.$queryRaw<{ name: string; subdomain: string; workspaceId: string; deletedAt: Date | null; deletedById: string | null }[]>`
        SELECT name, subdomain, "workspaceId", "deletedAt", "deletedById" FROM properties WHERE id = ${id} FOR UPDATE`
      if (!row) return false
      if (!workspaceId && (!row.deletedAt || row.deletedAt >= cutoff)) return false

      await tx.invoice.deleteMany({ where: { propertyId: id } })
      await tx.payment.deleteMany({ where: { propertyId: id } })
      await tx.booking.deleteMany({ where: { propertyId: id } })
      await tx.notification.deleteMany({ where: { propertyId: id } })
      await tx.activityLog.deleteMany({
        where: { propertyId: id, NOT: { entityType: 'PROPERTY', entityId: id, action: { in: ['DELETE', 'RESTORE'] } } },
      })
      await tx.property.deleteMany({ where: { id } })
      await tx.activityLog.create({
        data: {
          workspaceId: row.workspaceId,
          action: 'PURGE',
          entityType: 'PROPERTY',
          entityId: id,
          metadata: {
            name: row.name,
            subdomain: row.subdomain,
            deletedAt: row.deletedAt?.toISOString() ?? null,
            deletedById: row.deletedById,
            ...(workspaceId && { withWorkspace: true }),
          },
        },
      })
      return true
    },
    { timeout: 60_000 }
  )
}

/**
 * The workspace, once its properties are gone. Members, invitations, the
 * plan and its payments cascade from it. Its activity log and bell notices
 * go; one PURGE entry, outside any workspace, says it is gone.
 */
async function purgeWorkspace(id: string, cutoff: Date): Promise<boolean> {
  return prismaWithDeleted.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ name: string; slug: string; ownerId: string; deletedAt: Date | null; deletedById: string | null }[]>`
      SELECT name, slug, "ownerId", "deletedAt", "deletedById" FROM workspaces WHERE id = ${id} FOR UPDATE`
    if (!row?.deletedAt || row.deletedAt >= cutoff) return false
    // A property added meanwhile cannot exist (the workspace is hidden), but never orphan one.
    if ((await tx.property.count({ where: { workspaceId: id } })) > 0) return false

    await tx.notification.deleteMany({ where: { workspaceId: id } })
    await tx.activityLog.deleteMany({ where: { workspaceId: id } })
    // A plan it paid for is Digistay's own sale (the payment, its e-invoice:
    // src/lib/billing), an accounting record to keep: the row stays, emptied
    // and hidden, its slug freed; everything else of it goes.
    const sales = await tx.subscriptionPayment.count({ where: { workspaceId: id, status: 'PAID' } })
    if (sales > 0) {
      await tx.workspaceMember.deleteMany({ where: { workspaceId: id } })
      await tx.invitation.deleteMany({ where: { workspaceId: id } })
      await tx.subscriptionPayment.deleteMany({ where: { workspaceId: id, status: { not: 'PAID' } } })
      await tx.workspace.update({
        where: { id },
        data: { slug: `${KEPT_PREFIX}${id}`, domain: null, logo: null, description: null, settings: {} },
      })
    } else {
      await tx.workspace.deleteMany({ where: { id } })
    }
    await tx.activityLog.create({
      data: {
        action: 'PURGE',
        entityType: 'WORKSPACE',
        entityId: id,
        metadata: {
          name: row.name,
          slug: row.slug,
          ownerId: row.ownerId,
          deletedAt: row.deletedAt.toISOString(),
          deletedById: row.deletedById,
          ...(sales > 0 && { keptForPlanPayments: sales }),
        },
      },
    })
    return true
  })
}
