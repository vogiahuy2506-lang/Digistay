/**
 * Centralised role-based access control.
 *
 * Use these helpers from API routes and server components instead of
 * scattering `role === 'ADMIN'` checks everywhere. Routes can declare
 * which roles are allowed and get back a 403 NextResponse when the
 * caller is not authorised.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { WorkspaceRole } from '@prisma/client'

export type AllowedRoles = readonly WorkspaceRole[]

/**
 * Require that the current user is logged in. Returns the session on
 * success, or a 401 NextResponse on failure (so callers can `return` it
 * directly).
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      ),
    }
  }
  return { ok: true as const, session }
}

/**
 * Resolve the caller's effective role for a workspace. Owners are
 * treated as ADMIN. Members get their stored role. Everyone else is
 * `null` — including a member locked because the workspace is over its
 * plan's staff limit (WorkspaceMember.planLockedAt, src/lib/billing/overage.ts):
 * they have no access until unlocked. Queries that check membership
 * themselves add `planLockedAt: null` (src/app/api/member-filter.test.ts).
 */
export async function getWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      members: {
        where: { userId, planLockedAt: null },
        select: { role: true },
        take: 1,
      },
    },
  })
  if (!workspace) return null
  if (workspace.ownerId === userId) return 'ADMIN'
  return workspace.members[0]?.role ?? null
}

/**
 * Resolve the caller's effective role for a workspace, looked up by
 * the workspace's slug instead of its id. A locked member's role is null
 * too, with `planLocked` set so the page can say why.
 */
export async function getWorkspaceRoleBySlug(
  slug: string,
  userId: string
): Promise<{ workspaceId: string; role: WorkspaceRole | null; planLocked?: boolean } | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: {
      id: true,
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true, planLockedAt: true },
        take: 1,
      },
    },
  })
  if (!workspace) return null
  if (workspace.ownerId === userId) return { workspaceId: workspace.id, role: 'ADMIN' }
  const member = workspace.members[0]
  if (member?.planLockedAt) return { workspaceId: workspace.id, role: null, planLocked: true }
  return { workspaceId: workspace.id, role: member?.role ?? null }
}

/**
 * Require that the caller has one of the allowed roles in the given
 * workspace. Owners always pass.
 */
export async function requireWorkspaceRole(
  workspaceId: string,
  allowed: AllowedRoles
): Promise<
  | { ok: true; userId: string; role: WorkspaceRole }
  | { ok: false; response: NextResponse }
> {
  const sess = await requireSession()
  if (!sess.ok) return sess
  const role = await getWorkspaceRole(workspaceId, sess.session.user.id)
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập workspace này' },
        { status: 403 }
      ),
    }
  }
  if (!allowed.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Bạn không có quyền thực hiện hành động này' },
        { status: 403 }
      ),
    }
  }
  return { ok: true, userId: sess.session.user.id, role }
}

/**
 * Default role sets used by API routes. Export here so callers don't
 * have to know the enum members.
 */
export const WorkspaceRoles = {
  ADMINS: ['ADMIN'] as const,
  ADMINS_AND_MANAGERS: ['ADMIN', 'MANAGER'] as const,
  STAFF_AND_UP: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] as const,
  ALL_MEMBERS: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'] as const,
}
