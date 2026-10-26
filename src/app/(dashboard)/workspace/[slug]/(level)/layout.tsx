import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { WorkspaceTopBar } from '@/components/layout/workspace-top-bar'
import { WorkspaceRoleProvider } from '@/components/layout/workspace-role-provider'
import { PlanBanner } from '@/components/layout/plan-banner'
import { WorkspaceLevelTitle } from '@/components/layout/document-title'

/**
 * The workspace level — the property list, members and settings — has the
 * same frame as /workspaces: one slim top bar, no sidebar. The sidebar
 * belongs to a single property, where there is a menu worth showing.
 *
 * Widths: the bar spans the window; the page gets the property pages' column
 * (PageContainer: max-w-7xl, same side padding). Lists use all of it; a page
 * that is one form wraps its title and card in `mx-auto max-w-3xl`, so the
 * two stay together in the middle instead of hugging the left edge.
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
        <WorkspaceTopBar
          workspace={data.workspace}
          workspaces={data.workspaces}
          userName={data.userName}
          userEmail={data.userEmail}
          userImage={data.userImage}
        />
        <PlanBanner plan={data.plan} slug={data.workspace.slug} role={data.workspace.role} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {children}
        </main>
      </div>
    </WorkspaceRoleProvider>
  )
}