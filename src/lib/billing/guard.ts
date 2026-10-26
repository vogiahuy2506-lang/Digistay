/**
 * The checks API routes make before changing a workspace's data:
 *
 * - locked: 7 days past the end of the paid period (or trial) the workspace
 *   is read-only until it buys a plan. Reading, the plan page, payments
 *   from guests and webhooks keep working; changes are refused with 402.
 * - over the limit: adding a property, rooms, a staff account or an
 *   e-invoice beyond the plan is refused with 403.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { planLimitProblem, type LimitKind } from './limits'
import { workspacePlan } from './subscription'

export const WORKSPACE_LOCKED = 'Gói của workspace đã hết hạn quá 7 ngày nên đang bị khoá (chỉ xem). Gia hạn trong Gói & thanh toán để tiếp tục.'
/** What a guest is told (403) when booking or holding a room online at a locked workspace's hotel. */
export const ONLINE_BOOKING_PAUSED = 'Khách sạn đang tạm ngừng nhận đặt phòng online. Vui lòng liên hệ trực tiếp khách sạn.'

/** Whether the workspace is read-only now. */
export async function isWorkspaceLocked(workspaceId: string): Promise<boolean> {
  return (await workspacePlan(workspaceId)).state === 'locked'
}

/** 402 when the workspace is read-only, else null: `const blocked = await lockedResponse(id); if (blocked) return blocked`. */
export async function lockedResponse(workspaceId: string): Promise<NextResponse | null> {
  if (!(await isWorkspaceLocked(workspaceId))) return null
  return NextResponse.json({ success: false, error: WORKSPACE_LOCKED, code: 'WORKSPACE_LOCKED' }, { status: 402 })
}

/** The same for a property's workspace. Unknown property: null (the route answers 404 itself). */
export async function lockedResponseForProperty(propertyId: string): Promise<NextResponse | null> {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property ? lockedResponse(property.workspaceId) : null
}

/** 402 when locked, 403 when `adding` more of `kind` passes the plan's limit, else null. */
export async function planResponse(workspaceId: string, kind: LimitKind, adding: number): Promise<NextResponse | null> {
  const locked = await lockedResponse(workspaceId)
  if (locked) return locked
  const problem = await planLimitProblem(workspaceId, kind, adding)
  if (!problem) return null
  return NextResponse.json({ success: false, error: problem, code: 'PLAN_LIMIT' }, { status: 403 })
}
