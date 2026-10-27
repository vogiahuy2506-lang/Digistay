import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { WorkspaceShell } from '@/components/layout/workspace-shell'
import { WorkspaceAccessProvider } from '@/components/layout/workspace-access-provider'
import { PlanBanner } from '@/components/layout/plan-banner'
import { PlanLimitPrompt } from '@/components/billing/plan-limit-prompt'

/**
 * Every page inside a workspace wears the same frame: the sidebar (the
 * property's menu, then the workspace's: members, plan, settings), so going
 * from a property's bookings to the members never changes the frame. One
 * layout for the workspace level and the property pages, so the sidebar is
 * not drawn again when moving between them.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await loadWorkspaceShell(slug)

  const { role, isOwner, customPermissions, permissions, propertyIds } = data.workspace

  return (
    <WorkspaceAccessProvider value={{ role, isOwner, customPermissions, permissions, propertyIds }}>
      <WorkspaceShell
        workspace={data.workspace}
        workspaces={data.workspaces}
        userName={data.userName}
        userEmail={data.userEmail}
        userImage={data.userImage}
      >
        <PlanBanner plan={data.plan} slug={data.workspace.slug} canBuy={permissions.includes('billing_manage')} />
        {children}
        {/* A change refused for the plan (over its limits, or locked) opens the way to upgrade. After
            the page so its dialog is drawn above the page's own (Modal renders in place, no portal). */}
        <PlanLimitPrompt slug={data.workspace.slug} canBuy={permissions.includes('billing_manage')} />
      </WorkspaceShell>
    </WorkspaceAccessProvider>
  )
}
