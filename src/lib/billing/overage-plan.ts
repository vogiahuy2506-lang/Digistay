/**
 * What to lock when a workspace uses more than its plan allows, and what to
 * unlock once there is room again — the arithmetic only, no database
 * (src/lib/billing/overage.ts applies it). Decisions (2026-10-26, "như
 * UKNOW"):
 *
 * - Only unlocked things count: a locked property's rooms, a locked room
 *   type's rooms and a locked member are not used.
 * - Locking goes newest first (by creation) until the counts fit:
 *   properties, then whole room types (active, of unlocked properties),
 *   then staff: open invitations are revoked first, then members are
 *   locked. The owner is never counted nor locked; nothing is deleted.
 * - Unlocking goes oldest-locked first, each item only when it fits every
 *   limit (a property brings its rooms back with it), so an unlock never
 *   puts the workspace over its plan again.
 */

export interface OverageLimits {
  properties: number
  rooms: number
  staff: number
}

export type OverageKind = keyof OverageLimits
export const OVERAGE_KINDS: readonly OverageKind[] = ['properties', 'rooms', 'staff']

export interface PropertyItem {
  id: string
  createdAt: Date
  planLockedAt: Date | null
}

export interface RoomTypeItem {
  id: string
  propertyId: string
  createdAt: Date
  planLockedAt: Date | null
  isActive: boolean
  totalRooms: number
}

/** A member other than the owner. */
export interface MemberItem {
  userId: string
  joinedAt: Date
  planLockedAt: Date | null
}

/** An invitation still open (it takes a staff seat). */
export interface InvitationItem {
  id: string
  createdAt: Date
}

export interface Holdings {
  properties: PropertyItem[]
  roomTypes: RoomTypeItem[]
  members: MemberItem[]
  invitations: InvitationItem[]
}

export interface OverageUsage {
  properties: number
  rooms: number
  staff: number
}

/** Ids to lock (and invitations to revoke). */
export interface LockPlan {
  properties: string[]
  roomTypes: string[]
  members: string[]
  invitations: string[]
}

/** Ids to unlock. */
export interface UnlockPlan {
  properties: string[]
  roomTypes: string[]
  members: string[]
}

const newestFirst = (a: { at: Date; id: string }, b: { at: Date; id: string }) =>
  b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

/** Oldest-locked first; among those locked together, the oldest made first (the reverse of how they were locked). */
const oldestLockedFirst = (a: { lockedAt: Date; at: Date; id: string }, b: { lockedAt: Date; at: Date; id: string }) =>
  a.lockedAt.getTime() - b.lockedAt.getTime() || a.at.getTime() - b.at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Rooms that count: active, unlocked room types of unlocked properties. */
function countedRooms(roomTypes: RoomTypeItem[], lockedProperties: Set<string>, lockedTypes: Set<string>): number {
  let rooms = 0
  for (const rt of roomTypes) {
    if (rt.isActive && !lockedTypes.has(rt.id) && !lockedProperties.has(rt.propertyId)) rooms += Math.max(0, rt.totalRooms)
  }
  return rooms
}

const lockedSet = (items: { id: string; planLockedAt: Date | null }[]) => new Set(items.filter((i) => i.planLockedAt).map((i) => i.id))

/** What counts against the plan now. */
export function countUsage(h: Holdings): OverageUsage {
  const lockedProperties = lockedSet(h.properties)
  return {
    properties: h.properties.length - lockedProperties.size,
    rooms: countedRooms(h.roomTypes, lockedProperties, lockedSet(h.roomTypes)),
    staff: h.members.filter((m) => !m.planLockedAt).length + h.invitations.length,
  }
}

/** The kinds used beyond the plan. */
export function overKinds(usage: OverageUsage, limits: OverageLimits): OverageKind[] {
  return OVERAGE_KINDS.filter((kind) => usage[kind] > limits[kind])
}

/** What to lock, newest first, so that every count fits its limit. Nothing when it already fits. */
export function planLocks(h: Holdings, limits: OverageLimits): LockPlan {
  const plan: LockPlan = { properties: [], roomTypes: [], members: [], invitations: [] }
  const lockedProperties = lockedSet(h.properties)
  const lockedTypes = lockedSet(h.roomTypes)

  // Properties: each weighs one, so stopping as soon as it fits is exact.
  let properties = h.properties.length - lockedProperties.size
  const openProperties = h.properties
    .filter((p) => !p.planLockedAt)
    .map((p) => ({ id: p.id, at: p.createdAt }))
    .sort(newestFirst)
  for (const p of openProperties) {
    if (properties <= limits.properties) break
    plan.properties.push(p.id)
    lockedProperties.add(p.id)
    properties--
  }

  // Room types, whole ones, newest first; then any picked one that fits
  // back after all (a big type made room for a small one) is given back,
  // so no more rooms are locked than needed.
  let rooms = countedRooms(h.roomTypes, lockedProperties, lockedTypes)
  const openTypes = h.roomTypes
    .filter((rt) => rt.isActive && rt.totalRooms > 0 && !rt.planLockedAt && !lockedProperties.has(rt.propertyId))
    .map((rt) => ({ id: rt.id, at: rt.createdAt, rooms: rt.totalRooms }))
    .sort(newestFirst)
  const picked: typeof openTypes = []
  for (const rt of openTypes) {
    if (rooms <= limits.rooms) break
    picked.push(rt)
    rooms -= rt.rooms
  }
  for (const rt of [...picked].reverse()) {
    if (rooms + rt.rooms <= limits.rooms) {
      picked.splice(picked.indexOf(rt), 1)
      rooms += rt.rooms
    }
  }
  plan.roomTypes = picked.map((rt) => rt.id)

  // Staff: open invitations go first (nobody loses access), then members.
  let staff = h.members.filter((m) => !m.planLockedAt).length + h.invitations.length
  for (const inv of h.invitations.map((i) => ({ id: i.id, at: i.createdAt })).sort(newestFirst)) {
    if (staff <= limits.staff) break
    plan.invitations.push(inv.id)
    staff--
  }
  const openMembers = h.members
    .filter((m) => !m.planLockedAt)
    .map((m) => ({ id: m.userId, at: m.joinedAt }))
    .sort(newestFirst)
  for (const m of openMembers) {
    if (staff <= limits.staff) break
    plan.members.push(m.id)
    staff--
  }
  return plan
}

/**
 * What to unlock, oldest-locked first, each only when it fits every limit:
 * a property needs a free property slot and room for its counted rooms; a
 * room type (of an unlocked property) room for its rooms; a member a free
 * staff seat. A locked room type that is not active counts for nothing,
 * so it is unlocked at once (turning it on later goes through the limit).
 */
export function planUnlocks(h: Holdings, limits: OverageLimits): UnlockPlan {
  const plan: UnlockPlan = { properties: [], roomTypes: [], members: [] }
  const lockedProperties = lockedSet(h.properties)
  const lockedTypes = lockedSet(h.roomTypes)
  let properties = h.properties.length - lockedProperties.size
  let rooms = countedRooms(h.roomTypes, lockedProperties, lockedTypes)

  const roomsOf = (propertyId: string) =>
    h.roomTypes.reduce((sum, rt) => (rt.propertyId === propertyId && rt.isActive && !lockedTypes.has(rt.id) ? sum + Math.max(0, rt.totalRooms) : sum), 0)

  const waitingProperties = h.properties
    .filter((p): p is PropertyItem & { planLockedAt: Date } => !!p.planLockedAt)
    .map((p) => ({ id: p.id, at: p.createdAt, lockedAt: p.planLockedAt }))
    .sort(oldestLockedFirst)
  for (const p of waitingProperties) {
    const brings = roomsOf(p.id)
    if (properties + 1 > limits.properties || rooms + brings > limits.rooms) continue
    plan.properties.push(p.id)
    lockedProperties.delete(p.id)
    properties++
    rooms += brings
  }

  const waitingTypes = h.roomTypes
    .filter((rt): rt is RoomTypeItem & { planLockedAt: Date } => !!rt.planLockedAt && !lockedProperties.has(rt.propertyId))
    .map((rt) => ({ id: rt.id, at: rt.createdAt, lockedAt: rt.planLockedAt, rooms: rt.isActive ? Math.max(0, rt.totalRooms) : 0 }))
    .sort(oldestLockedFirst)
  for (const rt of waitingTypes) {
    if (rooms + rt.rooms > limits.rooms) continue
    plan.roomTypes.push(rt.id)
    rooms += rt.rooms
  }

  let staff = h.members.filter((m) => !m.planLockedAt).length + h.invitations.length
  const waitingMembers = h.members
    .filter((m): m is MemberItem & { planLockedAt: Date } => !!m.planLockedAt)
    .map((m) => ({ id: m.userId, at: m.joinedAt, lockedAt: m.planLockedAt }))
    .sort(oldestLockedFirst)
  for (const m of waitingMembers) {
    if (staff + 1 > limits.staff) break
    plan.members.push(m.id)
    staff++
  }
  return plan
}

/** The holdings after a lock plan, locked at `at`. */
export function withLocks(h: Holdings, plan: LockPlan, at: Date): Holdings {
  const lock = <T extends { planLockedAt: Date | null }>(item: T, picked: boolean): T => (picked ? { ...item, planLockedAt: at } : item)
  return {
    properties: h.properties.map((p) => lock(p, plan.properties.includes(p.id))),
    roomTypes: h.roomTypes.map((rt) => lock(rt, plan.roomTypes.includes(rt.id))),
    members: h.members.map((m) => lock(m, plan.members.includes(m.userId))),
    invitations: h.invitations.filter((i) => !plan.invitations.includes(i.id)),
  }
}

/** The holdings after an unlock plan. */
export function withUnlocks(h: Holdings, plan: UnlockPlan): Holdings {
  const unlock = <T extends { planLockedAt: Date | null }>(item: T, picked: boolean): T => (picked ? { ...item, planLockedAt: null } : item)
  return {
    properties: h.properties.map((p) => unlock(p, plan.properties.includes(p.id))),
    roomTypes: h.roomTypes.map((rt) => unlock(rt, plan.roomTypes.includes(rt.id))),
    members: h.members.map((m) => unlock(m, plan.members.includes(m.userId))),
    invitations: h.invitations,
  }
}

export const isEmptyPlan = (plan: LockPlan | UnlockPlan) => Object.values(plan).every((ids: string[]) => ids.length === 0)
