'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { isPropertyPermission, type Permission } from '@/lib/auth/permissions'
import type { WorkspaceRole } from './nav'

/** The signed-in user's access to the current workspace (src/lib/auth/access.ts), set by its layout. */
export interface WorkspaceAccessValue {
  role: WorkspaceRole
  isOwner: boolean
  customPermissions: boolean
  permissions: Permission[]
  /** The properties they may work on; null: every one. */
  propertyIds: string[] | null
}

export const WorkspaceAccessContext = React.createContext<WorkspaceAccessValue | null>(null)

export function useWorkspaceAccess() {
  return React.useContext(WorkspaceAccessContext)
}

/** Their role: a job title and permission preset, for labels. Checks use useCan. */
export function useWorkspaceRole() {
  return useWorkspaceAccess()?.role ?? null
}

/** Whether `access` has `permission`; for a per-property one with `propertyId`, there. */
export function accessCan(access: WorkspaceAccessValue | null, permission: Permission, propertyId?: string | null) {
  if (!access || !access.permissions.includes(permission)) return false
  if (propertyId && isPropertyPermission(permission) && access.propertyIds) return access.propertyIds.includes(propertyId)
  return true
}

/**
 * Whether the signed-in user may `permission` here: on the page's property
 * (the route's [id]) for a per-property one. What the API routes check too,
 * so a page hides what would be refused.
 */
export function useCan(permission: Permission): boolean {
  const access = useWorkspaceAccess()
  const params = useParams<{ id?: string }>()
  return accessCan(access, permission, params?.id)
}
