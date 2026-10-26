import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame } from '@/components/marketing/styles'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { NotificationBell } from '@/components/layout/notification-bell'
import { WorkspaceRoleProvider } from '@/components/layout/workspace-role-provider'
import { PlanBanner } from '@/components/layout/plan-banner'
import { WorkspaceLevelTitle } from '@/components/layout/document-title'
import { cn } from '@/lib/utils'

/**
 * The workspace level — the property list, members, settings, the plan —
 * wears the site header (the home page's, MarketingHeader) with the
 * workspace switcher next to the logo and the bell, and its frame, so header
 * and content line up like on /workspaces and /profile. No sidebar: that
 * belongs to a single property, where there is a menu worth showing.
 * A page that is one form wraps its title and card in `mx-auto max-w-3xl`.
 */
export default async function WorkspaceLevelLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await loadWorkspaceShell(slug)

  return (
    <WorkspaceRoleProvider role={data.workspace.role}>
      <WorkspaceLevelTitle workspaceName={data.workspace.name} />
      <div className="min-h-screen flex flex-col">
        <MarketingHeader
          context={<WorkspaceSwitcher workspace={data.workspace} workspaces={data.workspaces} />}
          actions={<NotificationBell />}
        />
        <PlanBanner plan={data.plan} slug={data.workspace.slug} role={data.workspace.role} />
        <main className={cn(frame, 'flex-1 py-10 sm:py-14')}>{children}</main>
      </div>
    </WorkspaceRoleProvider>
  )
}
