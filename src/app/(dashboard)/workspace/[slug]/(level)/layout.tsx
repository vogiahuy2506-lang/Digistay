import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame } from '@/components/marketing/styles'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { NotificationBell } from '@/components/layout/notification-bell'
import { PlanBanner } from '@/components/layout/plan-banner'
import { cn } from '@/lib/utils'

/**
 * The workspace level — the property list, members, settings, the plan —
 * wears the site header (MarketingHeader) with the workspace switcher next
 * to the logo and the notification bell, and its centered frame, exactly like
 * /workspaces and /profile. No sidebar: the sidebar belongs to a property page.
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
  const { permissions } = data.workspace

  return (
    <div className="flex min-h-screen flex-col bg-page text-fg">
      <MarketingHeader
        context={<WorkspaceSwitcher workspace={data.workspace} workspaces={data.workspaces} />}
        actions={<NotificationBell />}
      />
      <PlanBanner plan={data.plan} slug={data.workspace.slug} canBuy={permissions.includes('billing_manage')} />
      <main className={cn(frame, 'flex-1 py-10 sm:py-14')}>{children}</main>
    </div>
  )
}
