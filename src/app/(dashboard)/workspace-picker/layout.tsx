import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getWorkspaceRoleBySlug } from '@/lib/auth/rbac'
import { WorkspaceShell } from '@/components/layout/workspace-shell'

// This layout sits above [slug], so Next never passes it a slug: every
// /workspace-picker URL redirects to /workspaces (as on Next 14, where the
// type did not catch it). Next 15's typed routes do; behaviour kept as is.
export default async function WorkspacePickerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug?: string }>
}) {
  const { slug } = await params

  if (!slug) {
    redirect('/workspaces')
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Resolve workspace by slug + the caller's actual role. Owners are
  // treated as ADMIN; members get their stored role; everyone else is
  // redirected to the workspace list.
  const resolution = await getWorkspaceRoleBySlug(slug, session.user.id)
  if (!resolution || !resolution.role) {
    redirect('/workspaces')
  }
  const { workspaceId, role: workspaceRole } = resolution

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true, ownerId: true },
  })
  if (!workspace) {
    redirect('/workspaces')
  }

  // List user's other workspaces for the switcher, each with its
  // actual role (owner → ADMIN, member → stored role).
  const userWorkspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      members: {
        where: { userId: session.user.id },
        select: { role: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const workspacesForShell = userWorkspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    role: (w.ownerId === session.user.id ? 'ADMIN' : w.members[0]?.role ?? 'USER') as
      | 'ADMIN'
      | 'MANAGER'
      | 'RECEPTIONIST'
      | 'USER',
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
