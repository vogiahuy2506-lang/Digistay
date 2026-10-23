import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getWorkspaceRoleBySlug } from '@/lib/auth/rbac'
import type { WorkspaceRole } from '@/components/layout/nav'

export interface WorkspaceShellData {
  workspace: {
    id: string
    name: string
    slug: string
    role: WorkspaceRole
  }
  workspaces: { id: string; name: string; slug: string; role: WorkspaceRole }[]
  userName?: string
  userEmail?: string
  userImage?: string
}

/**
 * The signed-in user's workspace, their role in it, and the other workspaces
 * they can switch to. Redirects when there is no session or no access.
 */
export async function loadWorkspaceShell(slug: string): Promise<WorkspaceShellData> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  const resolution = await getWorkspaceRoleBySlug(slug, session.user.id)
  if (!resolution || !resolution.role) {
    // Not a member (or the workspace does not exist): the list of workspaces
    // is where they belong.
    redirect('/workspaces')
  }
  const { workspaceId, role } = resolution

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true, ownerId: true },
  })
  if (!workspace) {
    redirect('/workspaces')
  }

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

  return {
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role },
    workspaces: userWorkspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      role: (w.ownerId === session.user.id ? 'ADMIN' : w.members[0]?.role ?? 'USER') as WorkspaceRole,
    })),
    userName: session.user.name || undefined,
    userEmail: session.user.email,
    userImage: session.user.image || undefined,
  }
}