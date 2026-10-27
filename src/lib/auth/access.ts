/**
 * Who may do what in a workspace, on the server: every API route and server
 * page asks here (never `role === …` itself; src/app/api/access-checks.test.ts).
 *
 * A caller's access is the owner's (every permission, every property) or
 * their membership's: the permissions of src/lib/auth/permissions.ts and
 * the properties they may work on. A member locked by an admin (disabledAt)
 * or for being over the plan (planLockedAt) has none.
 *
 * Routes:
 *   const access = await requirePropertyAccess(propertyId, 'bookings_edit')
 *   if (!access.ok) return access.response
 * Lists across workspaces filter with accessibleProperties(userId, permission).
 */
import { NextResponse } from 'next/server'
import type { Prisma, WorkspaceRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import {
  PERMISSIONS,
  effectivePermissions,
  isPropertyPermission,
  rolesWith,
  type Permission,
} from './permissions'

export interface Access {
  workspaceId: string
  userId: string
  isOwner: boolean
  /** The member's role (their preset and job title); the owner's is ADMIN. */
  role: WorkspaceRole
  customPermissions: boolean
  permissions: ReadonlySet<Permission>
  /** The properties they may work on; null: every one of the workspace. */
  propertyIds: readonly string[] | null
}

export const NOT_SIGNED_IN = 'Vui lòng đăng nhập'
export const NO_WORKSPACE_ACCESS = 'Bạn không có quyền truy cập workspace này'
export const NO_PERMISSION = 'Bạn không có quyền thực hiện hành động này'
export const PROPERTY_NOT_FOUND = 'Không tìm thấy cơ sở'

/** A membership that grants access: not locked by an admin nor for the plan. */
export const ACTIVE_MEMBER = { planLockedAt: null, disabledAt: null } as const

const MEMBER_ACCESS = {
  role: true,
  permissions: true,
  customPermissions: true,
  allProperties: true,
  properties: { select: { propertyId: true } },
} as const

/** The caller's access to the workspace, or null (not a member, locked, or no such workspace). */
export async function getAccess(workspaceId: string, userId: string): Promise<Access | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      members: { where: { userId, planLockedAt: null, disabledAt: null }, select: MEMBER_ACCESS, take: 1 },
    },
  })
  if (!workspace) return null
  if (workspace.ownerId === userId) return ownerAccess(workspaceId, userId)
  const member = workspace.members[0]
  if (!member) return null
  return {
    workspaceId,
    userId,
    isOwner: false,
    role: member.role,
    customPermissions: member.customPermissions,
    permissions: new Set(effectivePermissions(member)),
    propertyIds: member.allProperties ? null : member.properties.map((p) => p.propertyId),
  }
}

function ownerAccess(workspaceId: string, userId: string): Access {
  return {
    workspaceId,
    userId,
    isOwner: true,
    role: 'ADMIN',
    customPermissions: false,
    permissions: new Set(PERMISSIONS),
    propertyIds: null,
  }
}

/** Whether the access reaches this property at all. */
export function seesProperty(access: Access, propertyId: string): boolean {
  return access.propertyIds === null || access.propertyIds.includes(propertyId)
}

/**
 * Whether the access has `permission`; for a per-property one with a
 * `propertyId`, on that property.
 */
export function can(access: Access, permission: Permission, propertyId?: string | null): boolean {
  if (!access.permissions.has(permission)) return false
  if (propertyId && isPropertyPermission(permission)) return seesProperty(access, propertyId)
  return true
}

/** The workspace's properties the access reaches, for a `where` on Property. */
export function propertyScope(access: Access): Prisma.PropertyWhereInput {
  return access.propertyIds === null
    ? { workspaceId: access.workspaceId }
    : { workspaceId: access.workspaceId, id: { in: [...access.propertyIds] } }
}

type Denied = { ok: false; response: NextResponse }
export type Granted = { ok: true; access: Access; userId: string }

function deny(status: number, error: string): Denied {
  return { ok: false, response: NextResponse.json({ success: false, error }, { status }) }
}

interface CheckOptions {
  /** The property acted on: a member who does not reach it is refused. */
  propertyId?: string | null
  /**
   * Answer an outsider (no access, or not to this property) with a 404 and
   * this message instead of a 403, so a record's id says nothing to them.
   */
  notFound?: string
}

/**
 * For a caller already known (`userId`): their access with `permission`
 * (null: any access) on the workspace, and on `propertyId` when given.
 */
export async function checkAccess(
  userId: string,
  workspaceId: string,
  permission: Permission | null,
  options: CheckOptions = {}
): Promise<Granted | Denied> {
  const access = await getAccess(workspaceId, userId)
  const outsider = !access || (options.propertyId != null && !seesProperty(access, options.propertyId))
  if (outsider) return options.notFound ? deny(404, options.notFound) : deny(403, NO_WORKSPACE_ACCESS)
  if (permission && !can(access, permission, options.propertyId)) return deny(403, NO_PERMISSION)
  return { ok: true, access, userId }
}

/** checkAccess for the signed-in caller; 401 without a session. */
export async function requireAccess(
  workspaceId: string,
  permission: Permission | null,
  options: CheckOptions = {}
): Promise<Granted | Denied> {
  const session = await auth()
  if (!session?.user?.id) return deny(401, NOT_SIGNED_IN)
  return checkAccess(session.user.id, workspaceId, permission, options)
}

/**
 * The signed-in caller's access to a property with `permission` (null: any
 * access). An unknown property, or one they do not reach, is a 404 with
 * `notFound`.
 */
export async function requirePropertyAccess(
  propertyId: string,
  permission: Permission | null,
  notFound: string = PROPERTY_NOT_FOUND
): Promise<(Granted & { property: { id: string; workspaceId: string } }) | Denied> {
  const session = await auth()
  if (!session?.user?.id) return deny(401, NOT_SIGNED_IN)
  return checkPropertyAccess(session.user.id, propertyId, permission, notFound)
}

/** requirePropertyAccess for a caller already known. */
export async function checkPropertyAccess(
  userId: string,
  propertyId: string,
  permission: Permission | null,
  notFound: string = PROPERTY_NOT_FOUND
): Promise<(Granted & { property: { id: string; workspaceId: string } }) | Denied> {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, workspaceId: true } })
  if (!property) return deny(404, notFound)
  const granted = await checkAccess(userId, property.workspaceId, permission, { propertyId, notFound })
  return granted.ok ? { ...granted, property } : granted
}

/** A membership's condition for having `permission`: by its role's preset, or ticked. */
function memberHas(permission: Permission): Prisma.WorkspaceMemberWhereInput {
  return {
    OR: [
      { customPermissions: false, role: { in: rolesWith(permission) } },
      { customPermissions: true, permissions: { has: permission } },
    ],
  }
}

/**
 * The properties `userId` may work on with `permission` (null: any access),
 * across all their workspaces: a `where` on Property for lists.
 */
export function accessibleProperties(userId: string, permission: Permission | null = null): Prisma.PropertyWhereInput {
  const grant = permission ? memberHas(permission) : {}
  return {
    OR: [
      { workspace: { ownerId: userId } },
      { workspace: { members: { some: { userId, planLockedAt: null, disabledAt: null, allProperties: true, ...grant } } } },
      { memberAccess: { some: { member: { userId, planLockedAt: null, disabledAt: null, allProperties: false, ...grant } } } },
    ],
  }
}

/**
 * The workspaces where `userId` has `permission` (null: any access): a
 * `where` on Workspace. For a per-property permission this says nothing of
 * which properties; use accessibleProperties for those.
 */
export function accessibleWorkspaces(userId: string, permission: Permission | null = null): Prisma.WorkspaceWhereInput {
  const grant = permission ? memberHas(permission) : {}
  return {
    OR: [{ ownerId: userId }, { members: { some: { userId, planLockedAt: null, disabledAt: null, ...grant } } }],
  }
}

/**
 * Who should hear of something at a property (the bell, staff emails): the
 * owner and the members with `permission` there. User ids, the owner first.
 */
export async function usersWithPermission(
  db: Pick<Prisma.TransactionClient, 'property'>,
  propertyId: string,
  permission: Permission
): Promise<string[]> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      workspace: {
        select: {
          ownerId: true,
          members: {
            where: {
              planLockedAt: null,
              disabledAt: null,
              AND: [memberHas(permission), { OR: [{ allProperties: true }, { properties: { some: { propertyId } } }] }],
            },
            select: { userId: true },
          },
        },
      },
    },
  })
  if (!property) return []
  return [...new Set([property.workspace.ownerId, ...property.workspace.members.map((m) => m.userId)])]
}
