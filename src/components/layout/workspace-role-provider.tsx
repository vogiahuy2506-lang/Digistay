'use client'

import * as React from 'react'
import { WorkspaceRoleContext } from './workspace-context'
import type { WorkspaceRole } from './nav'

/**
 * A client wrapper around the role context. A server component cannot render a
 * context provider itself — the context object does not cross the RSC
 * boundary — so the provider lives here.
 */
export function WorkspaceRoleProvider({
  role,
  children,
}: {
  role: WorkspaceRole
  children: React.ReactNode
}) {
  return <WorkspaceRoleContext.Provider value={role}>{children}</WorkspaceRoleContext.Provider>
}