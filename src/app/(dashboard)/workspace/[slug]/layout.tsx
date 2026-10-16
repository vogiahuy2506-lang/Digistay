import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { WorkspaceShell } from '@/components/layout/workspace-shell'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const { slug } = params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Resolve workspace by slug + role of current user
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      members: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
  })

  if (!workspace) {
    redirect('/workspaces')
  }

  const isOwner = workspace.ownerId === session.user.id
  const memberRole = workspace.members[0]?.role

  if (!isOwner && !memberRole) {
    // Not a member -> redirect to workspaces list
    redirect('/workspaces')
  }

  const workspaceRole = isOwner ? 'ADMIN' : (memberRole as any) || 'USER'

  // List user's other workspaces for the switcher
  const userWorkspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: { id: true, name: true, slug: true, ownerId: true },
    orderBy: { createdAt: 'asc' },
  })

  const workspacesForShell = userWorkspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    role: (w.ownerId === session.user.id ? 'ADMIN' : 'USER') as any,
  }))

  return (
    <WorkspaceShell
      workspace={{
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspaceRole,
      }}
      workspaces={workspacesForShell}
      userName={session.user.name || undefined}
      userEmail={session.user.email}
      userImage={session.user.image || undefined}
    >
      {children}
    </WorkspaceShell>
  )
}
