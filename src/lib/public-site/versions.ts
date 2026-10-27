/**
 * Version history of a hotel's website (the builder's "Lịch sử phiên bản").
 *
 * A save in the builder changes the live site at once, so a mistake used to
 * be final. Each save now keeps the site as saved (blocks, look, SEO texts)
 * in site_versions, in the same transaction as the save:
 *   - saves by the same person within MERGE_WINDOW_MS of the newest version
 *     update it instead of adding one (one "Lưu" is two requests, blocks
 *     then settings, and repeated clicks must not fill the list);
 *   - a save that changes nothing versioned (publishing) adds nothing;
 *   - the first versioned save keeps the site as it was before it (INITIAL),
 *     so a hotel that laid out its site before history began can go back;
 *   - the newest SITE_VERSION_LIMIT per property are kept.
 * Restore (POST /api/website/versions/[versionId]/restore) writes a snapshot
 * back; the preview ([subdomain]/phien-ban/[versionId]) renders one.
 *
 * Not versioned, on purpose: whether the site is published and its custom
 * domain (attached only after a DNS check), so a restore never takes a
 * live site offline or re-attaches a domain; and what other pages own
 * (rooms, photos, amenities, services, menu).
 *
 * This module only reads the site and writes site_versions: the writes to
 * the site itself stay in the route handlers, next to invalidatePublicSite
 * (src/app/api/public-site-cache.test.ts).
 */
import { BlockType, Prisma, type SiteVersionKind } from '@prisma/client'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { prisma } from '@/lib/db'

export const SITE_VERSION_LIMIT = 50
export const MERGE_WINDOW_MS = 2 * 60 * 1000

type Db = Prisma.TransactionClient

/** The website settings a version holds: what the builder's Style and Settings tabs save. */
const SETTINGS_SELECT = {
  primaryColor: true,
  secondaryColor: true,
  accentColor: true,
  buttonColor: true,
  headingColor: true,
  fontFamily: true,
  headingFont: true,
  layout: true,
  metaTitle: true,
  metaDescription: true,
  translations: true,
} satisfies Prisma.WebsiteSettingsSelect

/** The schema's defaults, for a site that had no settings row yet. */
const DEFAULT_SETTINGS = {
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',
  accentColor: '#F59E0B',
  buttonColor: null,
  headingColor: null,
  fontFamily: 'Inter',
  headingFont: 'Playfair Display',
  layout: 'modern',
  metaTitle: null,
  metaDescription: null,
  translations: null,
}

const snapshotSchema = z.object({
  v: z.literal(1),
  blocks: z.array(
    z.object({
      type: z.nativeEnum(BlockType),
      name: z.string(),
      config: z.record(z.unknown()),
      isEnabled: z.boolean(),
    })
  ),
  settings: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    accentColor: z.string(),
    buttonColor: z.string().nullable(),
    headingColor: z.string().nullable(),
    fontFamily: z.string(),
    headingFont: z.string(),
    layout: z.string(),
    metaTitle: z.string().nullable(),
    metaDescription: z.string().nullable(),
    translations: z.unknown(),
  }),
})

export type SiteSnapshot = z.infer<typeof snapshotSchema>

/** A stored snapshot, checked (it is JSON from the database); throws when it is not one. */
export function parseSiteSnapshot(value: unknown): SiteSnapshot {
  return snapshotSchema.parse(value)
}

/** The site as it is now: its blocks in order (turned off ones too) and its settings. */
export async function siteSnapshot(db: Db, propertyId: string): Promise<SiteSnapshot> {
  const [blocks, settings] = await Promise.all([
    db.websiteBlock.findMany({
      where: { propertyId },
      orderBy: { sortOrder: 'asc' },
      select: { type: true, name: true, config: true, isEnabled: true },
    }),
    db.websiteSettings.findUnique({ where: { propertyId }, select: SETTINGS_SELECT }),
  ])
  return {
    v: 1,
    blocks: blocks.map((b) => ({ ...b, config: (b.config ?? {}) as Record<string, unknown> })),
    settings: settings ?? DEFAULT_SETTINGS,
  }
}

/** The settings columns to write back for a snapshot (restore). */
export function snapshotSettingsData(snapshot: SiteSnapshot) {
  const { translations, ...rest } = snapshot.settings
  return { ...rest, translations: translations == null ? Prisma.DbNull : (translations as Prisma.InputJsonValue) }
}

/**
 * JSON with object keys sorted: Postgres jsonb reorders keys, so a snapshot
 * read back never stringifies like a fresh one.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** One writer at a time per property: the newest version is read, then updated or added to. */
async function lockVersions(db: Db, propertyId: string) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`site-versions:${propertyId}`}))::text`
}

const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

/**
 * Before the first versioned save of a site that already has something
 * saved: keeps it as it is (INITIAL), dated when it last changed. Call it in
 * the save's transaction, before the write.
 */
export async function keepSiteBaseline(db: Db, propertyId: string) {
  await lockVersions(db, propertyId)
  if (await db.siteVersion.findFirst({ where: { propertyId }, select: { id: true } })) return
  const [lastBlock, settings] = await Promise.all([
    db.websiteBlock.findFirst({ where: { propertyId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    db.websiteSettings.findUnique({ where: { propertyId }, select: { updatedAt: true } }),
  ])
  if (!lastBlock && !settings) return
  const changed = Math.max(lastBlock?.updatedAt.getTime() ?? 0, settings?.updatedAt.getTime() ?? 0)
  // Before the save's own version, even when both land in the same millisecond.
  const at = new Date(Math.min(changed, Date.now() - 1))
  await db.siteVersion.create({
    data: {
      propertyId,
      kind: 'INITIAL',
      snapshot: (await siteSnapshot(db, propertyId)) as unknown as Prisma.InputJsonObject,
      createdAt: at,
      updatedAt: at,
    },
  })
}

/**
 * Keeps the site as it is now as a version. Call it in the transaction that
 * changed the site, after the write. AUTO (a save) adds nothing when nothing
 * versioned changed, and updates the newest version when the same person
 * made it under MERGE_WINDOW_MS ago; RESTORE and BEFORE_RESTORE always add
 * one. Then drops all but the newest SITE_VERSION_LIMIT.
 */
export async function recordSiteVersion(
  db: Db,
  opts: { propertyId: string; userId: string; kind?: SiteVersionKind; restoredFromId?: string; at?: Date }
) {
  const { propertyId, userId, kind = 'AUTO' } = opts
  const at = opts.at ?? new Date()
  await lockVersions(db, propertyId)
  const snapshot = await siteSnapshot(db, propertyId)
  const json = snapshot as unknown as Prisma.InputJsonObject

  if (kind === 'AUTO') {
    const newest = await db.siteVersion.findFirst({ where: { propertyId }, orderBy: NEWEST_FIRST })
    if (newest && canonical(newest.snapshot) === canonical(snapshot)) return newest
    if (
      newest &&
      newest.kind === 'AUTO' &&
      newest.createdById === userId &&
      at.getTime() - newest.createdAt.getTime() < MERGE_WINDOW_MS
    ) {
      return db.siteVersion.update({ where: { id: newest.id }, data: { snapshot: json, updatedAt: at } })
    }
  }

  const version = await db.siteVersion.create({
    data: {
      propertyId,
      kind,
      snapshot: json,
      createdById: userId,
      restoredFromId: opts.restoredFromId ?? null,
      createdAt: at,
      updatedAt: at,
    },
  })
  const stale = await db.siteVersion.findMany({
    where: { propertyId },
    orderBy: NEWEST_FIRST,
    skip: SITE_VERSION_LIMIT,
    select: { id: true },
  })
  if (stale.length > 0) await db.siteVersion.deleteMany({ where: { id: { in: stale.map((v) => v.id) } } })
  return version
}

/**
 * A version to preview on the hotel's site: only for a signed-in user with
 * website_manage on it (who may edit the site), and only one of this site's
 * versions. null otherwise (the page answers 404, giving nothing away).
 */
export async function loadSiteVersionPreview(subdomain: string, versionId: string) {
  const userId = (await auth())?.user?.id
  if (!userId) return null
  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: { id: true, type: true, workspaceId: true, workspace: { select: { slug: true } } },
  })
  if (!property) return null
  if (!(await checkPropertyAccess(userId, property.id, 'website_manage')).ok) return null
  const version = await prisma.siteVersion.findFirst({ where: { id: versionId, propertyId: property.id } })
  if (!version) return null
  const author = version.createdById
    ? await prisma.user.findUnique({ where: { id: version.createdById }, select: { name: true, email: true } })
    : null
  return {
    propertyId: property.id,
    propertyType: property.type,
    workspaceSlug: property.workspace.slug,
    version: { id: version.id, kind: version.kind, savedAt: version.updatedAt, by: author?.name || author?.email || null },
    snapshot: parseSiteSnapshot(version.snapshot),
  }
}
