'use client'

import * as React from 'react'
import { WorkspaceAccessContext, type WorkspaceAccessValue } from './workspace-context'

/**
 * A client wrapper around the access context. A server component cannot
 * render a context provider itself — the context object does not cross the
 * RSC boundary — so the provider lives here.
 */
export function WorkspaceAccessProvider({ value, children }: { value: WorkspaceAccessValue; children: React.ReactNode }) {
  return <WorkspaceAccessContext.Provider value={value}>{children}</WorkspaceAccessContext.Provider>
}
