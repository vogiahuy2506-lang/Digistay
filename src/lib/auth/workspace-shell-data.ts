import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { accessibleWorkspaces, getAccess } from '@/lib/auth/access'
import type { Permission } from '@/lib/auth/permissions'
import type { WorkspaceRole } from '@/components/layout/nav'
import { workspacePlan } from '@/lib/billing/subscription'
import { welcomesTrial, type SubscriptionStateName } from '@/lib/billing/period'
import { overageBanner, type OverageBanner } from '@/lib/billing/overage'

export interface WorkspaceShellData {
  workspace: {
    id: string
    name: string
    slug: string
    /** The caller's role (their job title); the owner's is ADMIN. */
    role: WorkspaceRole
    isOwner: boolean
    /** Whether their permissions are their own ticked set rather than the role's. */
    customPermissions: boolean
    permissions: Permission[]
    /** The properties they may work on; null: every one. */
    propertyIds: string[] | null
  }
  workspaces: { id: string; name: string; slug: string; role: WorkspaceRole }[]
  userName?: string
  userEmail?: string
  userImage?: string
  /** The Digistay plan's state, for the banner (src/components/layout/plan-banner.tsx). */
  plan: {
    state: SubscriptionStateName
    trial: boolean
    planId: string
    daysLeft: number
    graceDaysLeft: number
    periodEnd: string
    /** Over the plan's limits or with things locked for it (src/lib/billing/overage.ts); null otherwise or while read-only. */
    overage: OverageBanner | null
    /** The owner is told once that the workspace got the free trial (src/components/billing/trial-welcome.tsx). */
    trialWelcome: boolean
    /** Days from the period's start to its end: a trial's length, which an operator may have changed (/admin). */
    periodDays: number
  }
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

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  })
  // Not a member, locked out, or no such workspace: the list of workspaces
  // is where they belong (and says why when they are locked).
  const access = workspace ? await getAccess(workspace.id, session.user.id) : null
  if (!workspace || !access) {
    redirect('/workspaces')
  }

  const userWorkspaces = await prisma.workspace.findMany({
    where: accessibleWorkspaces(session.user.id),
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      members: {
        where: { userId: session.user.id, planLockedAt: null, disabledAt: null },
        select: { role: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const plan = await workspacePlan(workspace.id)
  const overage = plan.state === 'locked' ? null : await overageBanner(workspace.id, plan.subscription.overLimitSince, plan.plan)

  return {
    plan: {
      state: plan.state,
      trial: plan.subscription.trial,
      planId: plan.planId,
      daysLeft: plan.daysLeft,
      graceDaysLeft: plan.graceDaysLeft,
      periodEnd: plan.subscription.periodEnd.toISOString(),
      overage,
      trialWelcome: welcomesTrial(plan.subscription, plan.state, access.isOwner),
      periodDays: Math.max(1, Math.round((plan.subscription.periodEnd.getTime() - plan.subscription.periodStart.getTime()) / 86_400_000)),
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: access.role,
      isOwner: access.isOwner,
      customPermissions: access.customPermissions,
      permissions: [...access.permissions],
      propertyIds: access.propertyIds && [...access.propertyIds],
    },
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