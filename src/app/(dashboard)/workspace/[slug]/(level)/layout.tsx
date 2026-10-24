import { loadWorkspaceShell } from '@/lib/auth/workspace-shell-data'
import { WorkspaceTopBar } from '@/components/layout/workspace-top-bar'
import { WorkspaceRoleProvider } from '@/components/layout/workspace-role-provider'

/**
 * The workspace level — the property list, members and settings — has the
 * same frame as /workspaces: one slim top bar, no sidebar. The sidebar
 * belongs to a single property, where there is a menu worth showing.
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
      <div className="min-h-screen flex flex-col">
        <WorkspaceTopBar
          workspace={data.workspace}
          workspaces={data.workspaces}
          userName={data.userName}
          userEmail={data.userEmail}
          userImage={data.userImage}
        />
        <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
          {children}
        </main>
      </div>
    </WorkspaceRoleProvider>
  )
}