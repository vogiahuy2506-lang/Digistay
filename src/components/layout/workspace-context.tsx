'use client'

import * as React from 'react'
import type { WorkspaceRole } from './nav'

/** The signed-in user's role in the current workspace, set by WorkspaceShell. */
export const WorkspaceRoleContext = React.createContext<WorkspaceRole | null>(null)

export function useWorkspaceRole() {
  return React.useContext(WorkspaceRoleContext)
}

/** Check-in, check-out, cancel, extend...: the roles the booking action APIs accept. */
export function canManageBookings(role: WorkspaceRole | null) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'RECEPTIONIST'
}
