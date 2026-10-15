import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/layout'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get user's workspaces and their role in each
  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      members: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Transform to include role
  const workspacesWithRole = workspaces.map(ws => ({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    role: ws.ownerId === session.user.id 
      ? 'ADMIN' as const 
      : ws.members[0]?.role as any || 'USER' as const,
  }))

  const defaultWorkspace = workspacesWithRole[0]

  // Check for workspace cookie
  const cookieStore = await cookies()
  const workspaceCookie = cookieStore.get('selectedWorkspace')
  const currentWorkspaceId = workspaceCookie?.value || defaultWorkspace?.id

  let currentWorkspace = defaultWorkspace
  if (currentWorkspaceId) {
    const workspace = workspacesWithRole.find(ws => ws.id === currentWorkspaceId)
    if (workspace) {
      currentWorkspace = workspace
    }
  }

  // Get full user role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        workspaceName={currentWorkspace?.name}
        workspaceId={currentWorkspace?.id}
        workspaceRole={currentWorkspace?.role}
        userName={session.user.name || undefined}
        userEmail={session.user.email}
        userImage={session.user.image || undefined}
        userRole={user?.role as any}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
