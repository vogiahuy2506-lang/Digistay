'use client'

/**
 * A workspace's plan as the operator pages show it (src/lib/admin/customers.ts
 * planView): in words, its state with the date that matters, and the usage
 * against the plan's limits.
 */
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { Pill, type Tone } from './admin-ui'

export const PLAN_STATES = ['trial', 'active', 'grace', 'locked'] as const
export type PlanStateName = (typeof PLAN_STATES)[number]
const PLANS = ['starter', 'growth', 'business'] as const
const USAGE = ['properties', 'rooms', 'staff'] as const
const has = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value)

export const stateTone: Record<PlanStateName, Tone> = { trial: 'info', active: 'ok', grace: 'warn', locked: 'bad' }

export interface PlanView {
  plan: string
  billing: 'MONTH' | 'YEAR' | null
  trial: boolean
  periodStart: string
  periodEnd: string
  nextPlan: string | null
  nextBilling: 'MONTH' | 'YEAR' | null
  nextPeriodEnd: string | null
  overLimitSince: string | null
  state: PlanStateName
  daysLeft: number
  locksAt: string
}
export type Usage = Record<'properties' | 'rooms' | 'staff' | 'invoices', number>

/** "Growth · Tháng", "Dùng thử Growth": a plan in words. */
export function usePlanName() {
  const t = useTranslations('dash.admin')
  return (plan: { plan: string; billing: 'MONTH' | 'YEAR' | null; trial: boolean }) => {
    const name = has(PLANS, plan.plan) ? t(`plans.${plan.plan as (typeof PLANS)[number]}`) : plan.plan
    if (plan.trial) return t('customers.trialOf', { plan: name })
    return plan.billing ? t('customers.planBilling', { plan: name, billing: t(`billing.${plan.billing}`) }) : name
  }
}

/** The state pill and the date that matters: the end, or when it locks. */
export function PlanState({ plan }: { plan: PlanView | null }) {
  const t = useTranslations('dash.admin')
  const labels = useDashLabels()
  if (!plan) return <span className="text-sm text-muted">{t('customers.noPlan')}</span>
  return (
    <div className="space-y-1">
      <Pill tone={stateTone[plan.state]}>{t(`states.${plan.state}`)}</Pill>
      <p className="text-xs text-muted">
        {plan.state === 'grace'
          ? t('customers.locksOn', { date: labels.date(plan.locksAt) })
          : `${t('customers.endsOn', { date: labels.date(plan.periodEnd) })}${plan.daysLeft > 0 ? ` · ${t('customers.daysLeft', { count: plan.daysLeft })}` : ''}`}
      </p>
    </div>
  )
}

export function UsageLine({ usage, limits }: { usage: Usage; limits: Usage }) {
  const t = useTranslations('dash.admin.customers.usage')
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
      {USAGE.map((kind) => (
        <span key={kind} className={cn('tabular-nums', usage[kind] > limits[kind] && 'font-semibold text-err')}>
          {t(kind)} {usage[kind]}/{limits[kind]}
        </span>
      ))}
    </span>
  )
}

