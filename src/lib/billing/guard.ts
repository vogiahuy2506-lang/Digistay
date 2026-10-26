/**
 * The checks API routes make before changing a workspace's data:
 *
 * - locked: 7 days past the end of the paid period (or trial) the workspace
 *   is read-only until it buys a plan. Reading, the plan page, payments
 *   from guests and webhooks keep working; changes are refused with 402.
 * - over the limit: adding a property, rooms, a staff account or an
 *   e-invoice beyond the plan is refused with 403.
 * - a property locked for being over the plan (src/lib/billing/overage.ts):
 *   the same read-only lock, for that property only (402). Its site stays
 *   up but takes no online bookings; a locked room type takes no new
 *   bookings, while its existing ones go on as usual.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { planLimitProblem, type LimitKind } from './limits'
import { workspacePlan } from './subscription'

export const WORKSPACE_LOCKED = 'Gói của workspace đã hết hạn quá 7 ngày nên đang bị khoá (chỉ xem). Gia hạn trong Gói & thanh toán để tiếp tục.'
/** What a guest is told (403) when booking or holding a room online at a locked workspace's hotel. */
export const ONLINE_BOOKING_PAUSED = 'Khách sạn đang tạm ngừng nhận đặt phòng online. Vui lòng liên hệ trực tiếp khách sạn.'
export const PROPERTY_PLAN_LOCKED =
  'Cơ sở này đang bị khoá (chỉ xem) vì workspace dùng vượt giới hạn gói. Nâng cấp gói hoặc giảm bớt cơ sở trong Gói & thanh toán để mở lại.'
/** Staff (409): a new booking or a move into a room type locked for being over the plan. */
export const ROOM_TYPE_PLAN_LOCKED =
  'Hạng phòng này đang bị khoá vì workspace dùng vượt giới hạn gói nên không nhận đơn mới. Nâng cấp gói hoặc giảm bớt phòng trong Gói & thanh toán để mở lại.'
/** A guest (403): that room type cannot be booked online for now. */
export const ROOM_TYPE_NOT_BOOKABLE = 'Hạng phòng này hiện không nhận đặt phòng online. Vui lòng chọn hạng phòng khác hoặc liên hệ trực tiếp khách sạn.'

/** Whether the workspace is read-only now. */
export async function isWorkspaceLocked(workspaceId: string): Promise<boolean> {
  return (await workspacePlan(workspaceId)).state === 'locked'
}

/** 402 when the workspace is read-only, else null: `const blocked = await lockedResponse(id); if (blocked) return blocked`. */
export async function lockedResponse(workspaceId: string): Promise<NextResponse | null> {
  if (!(await isWorkspaceLocked(workspaceId))) return null
  return NextResponse.json({ success: false, error: WORKSPACE_LOCKED, code: 'WORKSPACE_LOCKED' }, { status: 402 })
}

/**
 * The same for a property: 402 when its workspace is read-only, or when the
 * property itself is locked for being over the plan. Unknown property: null
 * (the route answers 404 itself).
 */
export async function lockedResponseForProperty(propertyId: string): Promise<NextResponse | null> {
  return (await propertyLock(propertyId))?.response ?? null
}

async function propertyLock(propertyId: string): Promise<{ workspaceId: string; response: NextResponse | null } | null> {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true, planLockedAt: true } })
  if (!property) return null
  const locked = await lockedResponse(property.workspaceId)
  if (locked || !property.planLockedAt) return { workspaceId: property.workspaceId, response: locked }
  return {
    workspaceId: property.workspaceId,
    response: NextResponse.json({ success: false, error: PROPERTY_PLAN_LOCKED, code: 'PROPERTY_PLAN_LOCKED' }, { status: 402 }),
  }
}

/** 402 when locked, 403 when `adding` more of `kind` passes the plan's limit, else null. */
export async function planResponse(workspaceId: string, kind: LimitKind, adding: number): Promise<NextResponse | null> {
  const locked = await lockedResponse(workspaceId)
  if (locked) return locked
  return limitResponse(workspaceId, kind, adding)
}

/** planResponse for a change at one property: also 402 when that property is locked. Unknown property: null. */
export async function planResponseForProperty(propertyId: string, kind: LimitKind, adding: number): Promise<NextResponse | null> {
  const found = await propertyLock(propertyId)
  if (!found) return null
  return found.response ?? limitResponse(found.workspaceId, kind, adding)
}

async function limitResponse(workspaceId: string, kind: LimitKind, adding: number): Promise<NextResponse | null> {
  const problem = await planLimitProblem(workspaceId, kind, adding)
  if (!problem) return null
  return NextResponse.json({ success: false, error: problem, code: 'PLAN_LIMIT' }, { status: 403 })
}

/**
 * Why a guest cannot book or hold this room type online now, or null: the
 * workspace is read-only, or the property or room type is locked for being
 * over the plan.
 */
export async function onlineBookingRefusal(roomType: {
  planLockedAt: Date | null
  property: { workspaceId: string; planLockedAt: Date | null }
}): Promise<string | null> {
  if (roomType.property.planLockedAt || (await isWorkspaceLocked(roomType.property.workspaceId))) return ONLINE_BOOKING_PAUSED
  if (roomType.planLockedAt) return ROOM_TYPE_NOT_BOOKABLE
  return null
}
