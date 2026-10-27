/**
 * What a workspace member may do, like UKNOW's employee permissions: each
 * member has a set of these. A role (WorkspaceRole) is a preset of them and
 * the member's job title; an admin may tick a member's own set instead
 * (WorkspaceMember.customPermissions). The owner has every one.
 *
 * The permissions of the first three groups apply per property: a member
 * limited to some properties (WorkspaceMember.allProperties false) has them
 * on those only. The workspace group applies to the workspace as a whole.
 *
 * Shared by the server (src/lib/auth/access.ts) and the dashboard (useCan in
 * src/components/layout/workspace-context.tsx), so nothing here touches the
 * database. Labels: dash.members.perm.<key> in messages/dash/<locale>/members.json.
 */

export const PERMISSION_GROUPS = {
  /** The front desk's day. */
  bookings: ['bookings_view', 'bookings_create', 'bookings_edit', 'bookings_cancel', 'bookings_delete', 'rooms_status'],
  money: ['payments_manage', 'invoices_manage', 'cashbook_view', 'revenue_view'],
  /** Setting a property up. */
  property: ['rooms_manage', 'room_types_manage', 'services_manage', 'property_edit', 'website_manage', 'payment_settings'],
  workspace: ['properties_create', 'members_manage', 'billing_manage', 'workspace_settings'],
} as const

export type PermissionGroup = keyof typeof PERMISSION_GROUPS
export type Permission = (typeof PERMISSION_GROUPS)[PermissionGroup][number]

export const PERMISSIONS: readonly Permission[] = Object.values(PERMISSION_GROUPS).flat()

const WORKSPACE_WIDE = new Set<Permission>(PERMISSION_GROUPS.workspace)

/** Whether `permission` applies per property (a member limited to some has it on those only). */
export function isPropertyPermission(permission: Permission): boolean {
  return !WORKSPACE_WIDE.has(permission)
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value)
}

/** Permissions that need another to be of use: acting on a booking needs seeing it. */
export const PERMISSION_REQUIRES: Partial<Record<Permission, Permission>> = {
  bookings_create: 'bookings_view',
  bookings_edit: 'bookings_view',
  bookings_cancel: 'bookings_view',
  bookings_delete: 'bookings_view',
  payments_manage: 'bookings_view',
  invoices_manage: 'bookings_view',
}

export type Role = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'
export const ROLES: readonly Role[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER']

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

const FRONT_DESK: Permission[] = [
  'bookings_view',
  'bookings_create',
  'bookings_edit',
  'bookings_cancel',
  'rooms_status',
  'payments_manage',
  'invoices_manage',
  'cashbook_view',
]

/** Each role's permissions, used as they are for a member without a set of their own. */
export const ROLE_PRESETS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: PERMISSIONS.filter((p) => p !== 'billing_manage' && p !== 'workspace_settings' && p !== 'payment_settings'),
  RECEPTIONIST: FRONT_DESK,
  USER: ['bookings_view', 'bookings_create', 'rooms_status'],
}

/** The roles whose preset has `permission`. */
export function rolesWith(permission: Permission): Role[] {
  return ROLES.filter((role) => ROLE_PRESETS[role].includes(permission))
}

/**
 * A ticked set made valid: known permissions only, each with what it needs,
 * in catalogue order (so two equal sets compare equal).
 */
export function normalizePermissions(values: readonly unknown[]): Permission[] {
  const set = new Set(values.filter(isPermission))
  for (const p of [...set]) {
    const needed = PERMISSION_REQUIRES[p]
    if (needed) set.add(needed)
  }
  return PERMISSIONS.filter((p) => set.has(p))
}

/** A member's permissions: their own set when they have one, else their role's. */
export function effectivePermissions(member: { role: Role; customPermissions: boolean; permissions: readonly string[] }): Permission[] {
  return member.customPermissions ? normalizePermissions(member.permissions) : [...ROLE_PRESETS[member.role]]
}

/** The role whose preset is exactly `permissions`, if any: how a ticked set is shown and stored. */
export function presetOf(permissions: readonly Permission[]): Role | null {
  const key = normalizePermissions(permissions).join(',')
  return ROLES.find((role) => ROLE_PRESETS[role].join(',') === key) ?? null
}
