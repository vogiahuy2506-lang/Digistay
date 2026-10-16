import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Workspace-scoped routes (under /workspace/[slug]) have their own
  // layout (WorkspaceShell) that handles its own sidebar.
  // This layout just passes children through.
  return <>{children}</>
}
