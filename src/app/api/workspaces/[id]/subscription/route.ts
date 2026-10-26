import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { PLANS, YEARLY_MONTHS } from '@/lib/marketing/plans'
import { workspacePlan } from '@/lib/billing/subscription'
import { workspaceUsage } from '@/lib/billing/limits'
import { platformPayosConfigured } from '@/lib/billing/platform-payos'
import { GRACE_DAYS, TRIAL_DAYS } from '@/lib/billing/period'
import { paymentView } from '@/lib/billing/view'

/**
 * GET /api/workspaces/[id]/subscription — the plan page (owner and admins):
 * the plan in force and its state, usage against its limits, the plans for
 * sale, the payment still waiting (to show its QR again) and past payments.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await requireWorkspaceRole(id, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response

  const [current, usage, workspace, payments] = await Promise.all([
    workspacePlan(id),
    workspaceUsage(id),
    prisma.workspace.findUnique({ where: { id }, select: { id: true, name: true, slug: true } }),
    prisma.subscriptionPayment.findMany({ where: { workspaceId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ])
  const waiting = payments.find((p) => p.status === 'PENDING' && (!p.expiresAt || p.expiresAt.getTime() > Date.now()))

  return NextResponse.json({
    success: true,
    data: {
      workspace,
      subscription: {
        plan: current.planId,
        billing: current.subscription.billing,
        trial: current.subscription.trial,
        periodStart: current.subscription.periodStart.toISOString(),
        periodEnd: current.subscription.periodEnd.toISOString(),
        state: current.state,
        daysLeft: current.daysLeft,
        graceDaysLeft: current.graceDaysLeft,
        locksAt: current.locksAt.toISOString(),
      },
      limits: { properties: current.plan.properties, rooms: current.plan.rooms, staff: current.plan.staff, invoices: current.plan.invoices },
      usage,
      plans: PLANS,
      yearlyMonths: YEARLY_MONTHS,
      trialDays: TRIAL_DAYS,
      graceDays: GRACE_DAYS,
      checkoutReady: platformPayosConfigured(),
      pending: waiting ? await paymentView(waiting) : null,
      payments: await Promise.all(payments.filter((p) => p.status === 'PAID' || p.status === 'PENDING').map((p) => paymentView({ ...p, qrCode: null }))),
    },
  })
}
