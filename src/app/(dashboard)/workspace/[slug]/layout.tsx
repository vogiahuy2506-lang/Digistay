import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { WorkspaceAccessProvider } from '@/components/layout/workspace-access-provider'
import { PlanLimitPrompt } from '@/components/billing/plan-limit-prompt'
import { TrialWelcome } from '@/components/billing/trial-welcome'

/**
 * Shared access provider & prompts for all workspace routes:
 * /workspace/[slug]/(level) for workspace-level pages (no sidebar, TopBar frame)
 * /workspace/[slug]/(property) for property pages (sidebar frame)
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
      {children}
      {/* A change refused for the plan (over its limits, or locked) opens the way to upgrade. After
          the page so its dialog is drawn above the page's own (Modal renders in place, no portal). */}
      <PlanLimitPrompt slug={data.workspace.slug} canBuy={permissions.includes('billing_manage')} />
      {/* The owner's first visit during the free trial: what they were given. */}
      {data.plan.trialWelcome && (
        <TrialWelcome
          workspaceId={data.workspace.id}
          workspaceName={data.workspace.name}
          slug={data.workspace.slug}
          periodEnd={data.plan.periodEnd}
          days={data.plan.periodDays}
          planId={data.plan.planId}
        />
      )}
    </WorkspaceAccessProvider>
  )
}
