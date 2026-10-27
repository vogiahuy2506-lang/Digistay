/**
 * Which Digistay plan would allow what the current plan just refused — the
 * arithmetic only, no database. src/lib/billing/limits.ts adds these facts
 * to a refusal (403 PLAN_LIMIT, src/lib/billing/guard.ts) and the dashboard
 * shows them with a way to upgrade (src/components/billing/plan-limit-prompt.tsx).
 */
import { PLANS, isPlanId, type Plan, type PlanId } from '@/lib/marketing/plans'
import type { LimitKind, Usage } from './limits'

export const LIMIT_KINDS: readonly LimitKind[] = ['properties', 'rooms', 'staff', 'invoices']

/** What a 403 PLAN_LIMIT carries as `limit`, next to its message. */
export interface PlanLimitFacts {
  kind: LimitKind
  /** What the workspace uses of `kind` now (workspaceUsage). */
  used: number
  /** The current plan's limit for `kind`; 0 for e-invoices on a plan without them. */
  limit: number
  /** How many more the refused change would add. */
  adding: number
  /** The plan in force (Growth during the trial). */
  plan: PlanId
  /** The cheapest plan that fits (planToFit), or null when none does. */
  suggested: PlanId | null
}

/**
 * The cheapest plan whose limit for `kind` fits what the workspace uses plus
 * `adding`, and which leaves no other limit passed either (a workspace can
 * be over its plan for a while: src/lib/billing/overage.ts), so the plan
 * suggested is one that ends the problem. Null when no plan fits: Digistay
 * has to be contacted, or the usage reduced.
 */
export function planToFit(usage: Usage, kind: LimitKind, adding: number, plans: readonly Plan[] = PLANS): PlanId | null {
  const needs: Usage = { ...usage, [kind]: usage[kind] + Math.max(adding, 0) }
  let best: Plan | null = null
  for (const plan of plans) {
    if (!LIMIT_KINDS.every((k) => needs[k] <= plan[k])) continue
    if (!best || plan.price < best.price) best = plan
  }
  return best?.id ?? null
}

const count = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

/**
 * The facts of a response body's `limit`, or null when it has none or they
 * are not well formed: the browser sees every API response, old servers'
 * included, and shows the plain message then.
 */
export function readPlanLimitFacts(value: unknown): PlanLimitFacts | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (!LIMIT_KINDS.includes(v.kind as LimitKind) || !count(v.used) || !count(v.limit) || !count(v.adding) || !isPlanId(v.plan)) return null
  if (v.suggested !== null && !isPlanId(v.suggested)) return null
  return { kind: v.kind as LimitKind, used: v.used, limit: v.limit, adding: v.adding, plan: v.plan, suggested: v.suggested }
}
