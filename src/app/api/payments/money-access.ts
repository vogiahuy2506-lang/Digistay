/**
 * Who sees what of a hotel's money, as the menu shows it
 * (src/components/layout/nav.ts): payments are worked by staff (owner,
 * ADMIN, MANAGER, RECEPTIONIST); revenue and money totals are for the
 * owner, ADMIN and MANAGER only. A plain USER member sees neither.
 *
 * Used by GET /api/payments and GET /api/invoices; GET
 * /api/workspaces/[id]/stats applies the same rule to its revenue fields.
 */
import type { Prisma, WorkspaceRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { WorkspaceRoles } from '@/lib/auth/rbac'

/** Workspaces the user owns or belongs to with one of `roles`. */
export function workspacesWithRole(userId: string, roles: readonly WorkspaceRole[]): Prisma.WorkspaceWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId, role: { in: [...roles] } } } },
    ],
  }
}

export const staffWorkspaces = (userId: string) => workspacesWithRole(userId, WorkspaceRoles.STAFF_AND_UP)
export const managerWorkspaces = (userId: string) => workspacesWithRole(userId, WorkspaceRoles.ADMINS_AND_MANAGERS)

/**
 * Whether the user may see money totals: of this property's workspace, or
 * (no property) of at least one workspace.
 */
export async function seesMoneyTotals(userId: string, propertyId?: string | null): Promise<boolean> {
  const count = await prisma.workspace.count({
    where: { ...managerWorkspaces(userId), ...(propertyId && { properties: { some: { id: propertyId } } }) },
  })
  return count > 0
}
