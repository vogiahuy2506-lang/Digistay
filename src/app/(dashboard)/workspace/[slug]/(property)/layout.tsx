import { cookies } from 'next/headers'
import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { SIDEBAR_COOKIE, parseSidebarPref } from '@/lib/sidebar'
import { WorkspaceShell } from '@/components/layout/workspace-shell'
import { PlanBanner } from '@/components/layout/plan-banner'

/**
 * Every property-scoped page (/workspace/[slug]/properties/[id]/*) wears
 * the workspace shell: the sidebar with the property's menu and workspace settings.
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
  const sidebar = parseSidebarPref((await cookies()).get(SIDEBAR_COOKIE)?.value)
  const { permissions } = data.workspace

  return (
    <WorkspaceShell
      workspace={data.workspace}
      workspaces={data.workspaces}
      userName={data.userName}
      userEmail={data.userEmail}
      userImage={data.userImage}
      isSuperAdmin={data.isSuperAdmin}
      sidebar={sidebar}
    >
      <PlanBanner plan={data.plan} slug={data.workspace.slug} canBuy={permissions.includes('billing_manage')} />
      {children}
    </WorkspaceShell>
  )
}
