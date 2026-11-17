import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createDefaultWorkspace } from '@/lib/auth/default-workspace'
import { workspacePlan } from '@/lib/billing/subscription'
import { getPlatformPlans } from '@/lib/plans/dynamic-plans'
import { platformPayosConfigured } from '@/lib/billing/platform-payos'
import { isPlatformEinvoiceReady, lastBuyer, platformVatLabel } from '@/lib/billing/einvoice'
import { paymentView } from '@/lib/billing/view'
import { PLAN_IDS, YEARLY_MONTHS, type Plan, type PlanId } from '@/lib/marketing/plans'
import { GRACE_DAYS, RENEW_WINDOW_DAYS, TRIAL_DAYS, planChange } from '@/lib/billing/period'
import { changeBlockMessage } from '@/lib/billing/checkout'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }

  const userId = session.user.id
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId, deletedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!workspace) {
    const created = await createDefaultWorkspace(userId, session.user.name || session.user.email || 'Hệ thống lưu trú')
    workspace = { id: created.id, name: created.name, slug: created.slug }
  }

  const now = new Date()
  const planQuery = request.nextUrl.searchParams.get('plan')
  const einvoiceReady = await isPlatformEinvoiceReady()

  const [current, dynamicPlans, buyer, me, payments] = await Promise.all([
    workspacePlan(workspace.id, prisma, now),
    getPlatformPlans(),
    einvoiceReady ? lastBuyer(workspace.id) : null,
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    prisma.subscriptionPayment.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { invoice: true },
    }),
  ])

  let allPlans: any[] = dynamicPlans
  if (planQuery && !dynamicPlans.some((p) => p.id === planQuery)) {
    try {
      const custom = await prisma.platformPlan.findUnique({ where: { id: planQuery } })
      if (custom && custom.isActive) {
        allPlans = [
          ...dynamicPlans,
          {
            id: custom.id,
            price: custom.price,
            properties: custom.properties,
            rooms: custom.rooms,
            staff: custom.staff,
            invoices: custom.invoices,
          },
        ]
      }
    } catch {
      // ignore
    }
  }

  const waiting = payments.find((p) => p.status === 'PENDING' && (!p.expiresAt || p.expiresAt.getTime() > Date.now()))
  const sub = current.subscription
  const planIdsToQuote = Array.from(new Set([...PLAN_IDS, ...allPlans.map((p) => p.id)]))
  const changes = Object.fromEntries(
    planIdsToQuote.map((plan) => [
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
      user: me,
      workspace,
      subscription: {
        plan: current.planId as PlanId,
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
      changes,
      plans: allPlans as unknown as Plan[],
      yearlyMonths: YEARLY_MONTHS,
      trialDays: TRIAL_DAYS,
      graceDays: GRACE_DAYS,
      checkoutReady: platformPayosConfigured(),
      einvoice: einvoiceReady ? { vat: platformVatLabel(), email: me?.email ?? null, lastBuyer: buyer } : null,
      pending: waiting ? await paymentView(waiting) : null,
    },
  })
}
