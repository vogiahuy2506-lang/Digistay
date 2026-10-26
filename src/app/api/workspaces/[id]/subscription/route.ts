import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { PLANS, PLAN_IDS, YEARLY_MONTHS } from '@/lib/marketing/plans'
import { workspacePlan } from '@/lib/billing/subscription'
import { workspaceUsage } from '@/lib/billing/limits'
import { platformPayosConfigured } from '@/lib/billing/platform-payos'
import { GRACE_DAYS, RENEW_WINDOW_DAYS, TRIAL_DAYS, planChange } from '@/lib/billing/period'
import { changeBlockMessage } from '@/lib/billing/checkout'
import { paymentView } from '@/lib/billing/view'
import { lastBuyer, platformEinvoiceConfigured, platformVatLabel } from '@/lib/billing/einvoice'
import { overageView } from '@/lib/billing/overage'

/**
 * GET /api/workspaces/[id]/subscription — the plan page (owner and admins):
 * the plan in force and its state, usage against its limits, the plans for
 * sale and what buying each would do now (period.ts planChange), a scheduled
 * downgrade, the payment still waiting (to show its QR again), past payments
 * and their e-invoices, and what the invoice step needs (src/lib/billing/einvoice.ts).
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await requireWorkspaceRole(id, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response

  const einvoice = platformEinvoiceConfigured()
  const [current, usage, workspace, payments, buyer, me, overage] = await Promise.all([
    workspacePlan(id),
    workspaceUsage(id),
    prisma.workspace.findUnique({ where: { id }, select: { id: true, name: true, slug: true } }),
    prisma.subscriptionPayment.findMany({ where: { workspaceId: id }, orderBy: { createdAt: 'desc' }, take: 20, include: { invoice: true } }),
    einvoice ? lastBuyer(id) : null,
    prisma.user.findUnique({ where: { id: access.userId }, select: { email: true } }),
    overageView(id),
  ])
  const waiting = payments.find((p) => p.status === 'PENDING' && (!p.expiresAt || p.expiresAt.getTime() > Date.now()))
  const sub = current.subscription
  const now = new Date()
  const changes = Object.fromEntries(
    PLAN_IDS.map((plan) => [
      plan,
      Object.fromEntries(
        (['MONTH', 'YEAR'] as const).map((billing) => {
          const c = planChange(sub, { plan, billing }, now)
          return [
            billing,
            {
              kind: c.kind,
              startsAt: c.startsAt.toISOString(),
              endsAt: c.endsAt.toISOString(),
              lostDays: c.lostDays,
              blocked: c.blocked,
              blockedReason: c.blocked ? changeBlockMessage(c.blocked, c, sub) : null,
              renewFrom: c.renewFrom?.toISOString() ?? null,
            },
          ]
        }),
      ),
    ]),
  )

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
        renewWindowDays: RENEW_WINDOW_DAYS[sub.billing ?? 'MONTH'],
      },
      // A paid downgrade waiting for the end of the period
      scheduled: sub.nextPlan
        ? { plan: sub.nextPlan, billing: sub.nextBilling, startsAt: sub.periodEnd.toISOString(), endsAt: sub.nextPeriodEnd?.toISOString() ?? null }
        : null,
      changes,
      limits: { properties: current.plan.properties, rooms: current.plan.rooms, staff: current.plan.staff, invoices: current.plan.invoices },
      usage,
      // Over the plan: the 7-day grace, then what is locked (src/lib/billing/overage.ts)
      overage,
      plans: PLANS,
      yearlyMonths: YEARLY_MONTHS,
      trialDays: TRIAL_DAYS,
      graceDays: GRACE_DAYS,
      checkoutReady: platformPayosConfigured(),
      // The invoice step at checkout: off until Digistay's Mắt Bão account is set.
      einvoice: einvoice ? { vat: platformVatLabel(), email: me?.email ?? null, lastBuyer: buyer } : null,
      pending: waiting ? await paymentView(waiting) : null,
      payments: await Promise.all(payments.filter((p) => p.status === 'PAID' || p.status === 'PENDING').map((p) => paymentView({ ...p, qrCode: null }))),
    },
  })
}
