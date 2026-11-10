import { prisma } from '@/lib/db'
import { PLANS, PLAN_IDS, type Plan, type PlanId } from '@/lib/marketing/plans'

/**
 * Returns dynamic plans configured by Superadmin in PlatformPlan table,
 * or default commercial plans if not configured yet.
 */
export async function getPlatformPlans(): Promise<Plan[]> {
  try {
    const rows = await prisma.platformPlan.findMany({
      where: { isActive: true },
    })

    if (rows && rows.length > 0) {
      return PLAN_IDS.map((id) => {
        const found = rows.find((r) => r.id === id)
        if (found) {
          return {
            id: found.id as PlanId,
            price: found.price,
            properties: found.properties,
            rooms: found.rooms,
            staff: found.staff,
            invoices: found.invoices,
          }
        }
        return PLANS.find((p) => p.id === id)!
      })
    }
  } catch {
    // If DB is offline or table hasn't migrated yet, fall back cleanly
  }
  return PLANS
}

export async function getPlatformPlanById(id: string): Promise<Plan> {
  const plans = await getPlatformPlans()
  return plans.find((p) => p.id === id) ?? PLANS.find((p) => p.id === id) ?? PLANS[1]
}

export async function getPlatformPlanPrice(plan: PlanId, billing: 'MONTH' | 'YEAR'): Promise<number> {
  const p = await getPlatformPlanById(plan)
  return billing === 'YEAR' ? p.price * 10 : p.price
}

