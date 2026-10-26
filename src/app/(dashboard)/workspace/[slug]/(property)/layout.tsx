import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { WorkspaceShell } from '@/components/layout/workspace-shell'
import { WorkspaceRoleProvider } from '@/components/layout/workspace-role-provider'
import { PlanBanner } from '@/components/layout/plan-banner'

/**
 * Inside one property the sidebar earns its place: the menu lists bookings,
 * the calendar, room types, invoices and the rest.
 */
export default async function WorkspacePropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await loadWorkspaceShell(slug)

  return (
    <WorkspaceShell
      workspace={data.workspace}
      workspaces={data.workspaces}
      userName={data.userName}
      userEmail={data.userEmail}
      userImage={data.userImage}
    >
      <PlanBanner plan={data.plan} slug={data.workspace.slug} role={data.workspace.role} />
      <WorkspaceRoleProvider role={data.workspace.role}>{children}</WorkspaceRoleProvider>
    </WorkspaceShell>
  )
}