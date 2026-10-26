/**
 * Soft-deleted properties and workspaces (src/lib/deletion) stay in the
 * database for 30 days so their owner can restore them, but the app must act
 * as if they were gone: dashboard lists and switchers, access checks, the
 * hotel's public site and the scheduled jobs. Rather than a `deletedAt: null`
 * in each of the hundreds of queries (and in every one written later), every
 * read through `prisma` (src/lib/db) is rewritten here:
 *
 * - a Property or Workspace row is read only when it is not deleted (a
 *   property also needs its workspace not deleted);
 * - a row that belongs to a property or a workspace (booking, payment,
 *   invoice, room type, member, invitation…: every model with a `property` /
 *   `workspace` relation, found in the schema) is read only when its property
 *   or workspace is live. Not the plan's own rows (Subscription,
 *   SubscriptionPayment): money paid to Digistay is recorded whatever happens,
 *   and src/lib/billing decides itself what to skip;
 * - relation filters on a property or workspace in `where` (`property: {…}`,
 *   `is`, `some`) match live ones only;
 * - lists of properties / workspaces in `include`, `select` and `_count` hold
 *   live ones only.
 *
 * Left alone: a `where` that sets `deletedAt` itself (the "recently deleted"
 * lists), writes (a route reads, and so checks, before it writes), `none` /
 * `every` / `isNot` / `NOT` filters, and raw SQL. `prismaWithDeleted` is the
 * client without any of this, for the deletion code itself and for the checks
 * that a name is free: a deleted hotel's subdomain, slug and custom domain
 * stay taken until it is purged, so a restore always works.
 */
import { Prisma } from '@prisma/client'

type Args = Record<string, unknown>

/** The models with a deletedAt of their own. */
const SOFT = new Set(['Property', 'Workspace'])
/** Rows of a workspace that are never hidden (see above). */
const NOT_HIDDEN = new Set(['Subscription', 'SubscriptionPayment'])
/** The operations rewritten: every read. */
const READS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
])

interface Relation {
  model: string
  list: boolean
}

/** Every model's relation fields, from the generated client's schema. */
const RELATIONS: Record<string, Record<string, Relation>> = {}
/** The relation to the property or workspace a model belongs to: Booking → 'property', Property → 'workspace'. */
const OWNER: Record<string, string> = {}
for (const model of Prisma.dmmf.datamodel.models) {
  const fields: Record<string, Relation> = {}
  for (const field of model.fields) {
    if (field.kind !== 'object') continue
    fields[field.name] = { model: field.type, list: field.isList }
    const holdsKey = (field.relationFromFields?.length ?? 0) > 0
    if (holdsKey && SOFT.has(field.type) && !NOT_HIDDEN.has(model.name) && !OWNER[model.name]) {
      OWNER[model.name] = field.name
    }
  }
  RELATIONS[model.name] = fields
}

const isObject = (value: unknown): value is Args => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * `where` on `model`, matching live rows only. `withOwner`: also require the
 * property / workspace the row belongs to (not needed for rows reached from
 * that property or workspace, which is already checked).
 */
export function liveWhere(model: string, where: unknown, withOwner: boolean): Args {
  const w: Args = isObject(where) ? { ...where } : {}
  if (SOFT.has(model) && w.deletedAt !== undefined) return relationsLive(model, w)
  if (SOFT.has(model)) w.deletedAt = null
  const owner = withOwner ? OWNER[model] : undefined
  if (owner && w[owner] === undefined) w[owner] = {}
  return relationsLive(model, w)
}

/** The relation filters inside `w` (a where on `model`), matching live rows only. */
function relationsLive(model: string, w: Args): Args {
  for (const key of Object.keys(w)) {
    const value = w[key]
    if (key === 'AND' || key === 'OR') {
      w[key] = Array.isArray(value)
        ? value.map((item) => (isObject(item) ? relationsLive(model, { ...item }) : item))
        : isObject(value)
          ? relationsLive(model, { ...value })
          : value
      continue
    }
    const relation = RELATIONS[model]?.[key]
    if (!relation || !isObject(value)) continue
    // A property reached from a row of it still needs a live workspace.
    const withOwner = relation.model === 'Property'
    if (relation.list) {
      if (isObject(value.some)) w[key] = { ...value, some: liveWhere(relation.model, value.some, false) }
    } else if ('is' in value || 'isNot' in value) {
      if (isObject(value.is) || (SOFT.has(relation.model) && value.is === undefined)) {
        w[key] = { ...value, is: liveWhere(relation.model, value.is, withOwner) }
      }
    } else {
      w[key] = liveWhere(relation.model, value, withOwner)
    }
  }
  return w
}

/** `include` / `select` on `model`: lists of properties / workspaces hold live ones only. */
function selectionLive(model: string, selection: Args): Args {
  const out: Args = { ...selection }
  for (const key of Object.keys(out)) {
    const value = out[key]
    if (key === '_count') {
      if (isObject(value) && isObject(value.select)) out[key] = { ...value, select: selectionLive(model, value.select) }
      continue
    }
    const relation = RELATIONS[model]?.[key]
    if (!relation || !value) continue
    if (relation.list && SOFT.has(relation.model)) {
      const nested = isObject(value) ? value : {}
      out[key] = nestedLive(relation.model, { ...nested, where: liveWhere(relation.model, nested.where, false) })
    } else if (isObject(value)) {
      out[key] = nestedLive(relation.model, value)
    }
  }
  return out
}

/** The arguments of a nested read (an include of a relation): its own where, include and select. */
function nestedLive(model: string, args: Args): Args {
  const out: Args = { ...args }
  if (isObject(out.where)) out.where = relationsLive(model, { ...out.where })
  if (isObject(out.include)) out.include = selectionLive(model, out.include)
  if (isObject(out.select)) out.select = selectionLive(model, out.select)
  return out
}

/** The arguments of one query, as `prisma` runs them (unchanged for writes and the plan's rows). */
export function liveArgs(model: string, operation: string, args: unknown): unknown {
  if (!READS.has(operation) || NOT_HIDDEN.has(model)) return args
  const out: Args = isObject(args) ? { ...args } : {}
  if (SOFT.has(model) || OWNER[model]) out.where = liveWhere(model, out.where, true)
  else if (isObject(out.where)) out.where = relationsLive(model, { ...out.where })
  if (isObject(out.include)) out.include = selectionLive(model, out.include)
  if (isObject(out.select)) out.select = selectionLive(model, out.select)
  return out
}

/** The extension `prisma` is built with (src/lib/db/prisma.ts). */
export const hideDeleted = Prisma.defineExtension({
  name: 'hide-deleted',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        return query(liveArgs(model, operation, args) as typeof args)
      },
    },
  },
})
