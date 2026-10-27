/**
 * What an admin gives a member, or an invitee on accepting: a role (preset
 * and job title), maybe their own ticked permissions, and the properties
 * they may work on. Used by the members and invitations routes.
 *
 * Nobody can give more than they have: a member with members_manage may
 * grant only permissions and properties they hold themselves, and may not
 * change a member who holds something they lack, nor themselves. The owner
 * is never changed here.
 */
import { z } from 'zod'
import type { Access } from '@/lib/auth/access'
import { ROLES, ROLE_PRESETS, effectivePermissions, normalizePermissions, type Permission, type Role } from '@/lib/auth/permissions'

export const grantSchema = z.object({
  role: z.enum(ROLES as [Role, ...Role[]]),
  /** Ticked permissions; left out: the role's preset. */
  permissions: z.array(z.string().max(40)).max(50).optional(),
  allProperties: z.boolean().default(true),
  propertyIds: z.array(z.string().max(40)).max(500).default([]),
})
export type GrantInput = z.infer<typeof grantSchema>

/** POST /api/workspaces/[id]/invitations. */
export const inviteMemberSchema = grantSchema.extend({
  email: z.string().email('Email không hợp lệ'),
})

/** As stored on WorkspaceMember and Invitation. */
export interface Grant {
  role: Role
  customPermissions: boolean
  permissions: Permission[]
  allProperties: boolean
  propertyIds: string[]
}

export const PICK_A_PROPERTY = 'Chọn ít nhất một cơ sở cho thành viên này'
export const UNKNOWN_PROPERTY = 'Có cơ sở không thuộc workspace này'
export const GRANT_TOO_WIDE = 'Bạn không thể cấp quyền mà chính bạn không có'
export const PROPERTIES_TOO_WIDE = 'Bạn chỉ có thể giao những cơ sở bạn đang được làm việc'
export const MEMBER_ABOVE_YOU = 'Bạn không thể thay đổi thành viên có quyền mà bạn không có'
export const NOT_YOURSELF = 'Bạn không thể tự thay đổi quyền của chính mình'

/**
 * The input made a Grant: a ticked set equal to the role's preset is stored
 * as the preset (so it follows the preset later). Properties are checked
 * against the workspace's (`workspaceProperties`); the message when invalid.
 */
export function toGrant(input: GrantInput, workspaceProperties: readonly string[]): Grant | string {
  const preset = ROLE_PRESETS[input.role]
  const ticked = input.permissions ? normalizePermissions(input.permissions) : [...preset]
  const custom = ticked.join(',') !== preset.join(',')
  const propertyIds = input.allProperties ? [] : [...new Set(input.propertyIds)]
  if (!input.allProperties) {
    if (propertyIds.length === 0) return PICK_A_PROPERTY
    if (propertyIds.some((id) => !workspaceProperties.includes(id))) return UNKNOWN_PROPERTY
  }
  return {
    role: input.role,
    customPermissions: custom,
    permissions: custom ? ticked : [],
    allProperties: input.allProperties,
    propertyIds,
  }
}

/** The grant's permissions, as the member will have them. */
export function grantPermissions(grant: Pick<Grant, 'role' | 'customPermissions' | 'permissions'>): Permission[] {
  return effectivePermissions(grant)
}

/** Whether `access` holds everything `grant` gives (permissions and properties); the message when not. */
export function grantProblem(access: Access, grant: Pick<Grant, 'role' | 'customPermissions' | 'permissions' | 'allProperties' | 'propertyIds'>): string | null {
  if (access.isOwner) return null
  if (grantPermissions(grant).some((p) => !access.permissions.has(p))) return GRANT_TOO_WIDE
  if (access.propertyIds !== null) {
    const mine = access.propertyIds
    if (grant.allProperties || grant.propertyIds.some((id) => !mine.includes(id))) return PROPERTIES_TOO_WIDE
  }
  return null
}

/**
 * Whether `access` may change or remove this member (not the owner: the
 * routes refuse that first); the message when not.
 */
export function memberProblem(
  access: Access,
  member: { userId: string; role: Role; customPermissions: boolean; permissions: string[]; allProperties: boolean; propertyIds: string[] }
): string | null {
  if (member.userId === access.userId) return NOT_YOURSELF
  if (access.isOwner) return null
  return grantProblem(access, {
    role: member.role,
    customPermissions: member.customPermissions,
    permissions: normalizePermissions(member.permissions),
    allProperties: member.allProperties,
    propertyIds: member.propertyIds,
  })
    ? MEMBER_ABOVE_YOU
    : null
}
