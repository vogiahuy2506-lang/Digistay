'use client'

import * as React from 'react'
import Link from 'next/link'
import { inkButton, revealDelay } from '@/components/marketing/styles'
import { cn } from '@/lib/utils'

export interface PlanCardView {
  id: string
  name: string
  fit: string
  monthly: string
  yearly: string
  /** "Tiết kiệm 1.980.000 ₫ …", shown with the yearly price. */
  saving: string
  isFeatured?: boolean
  trialDays?: number
  limits: { label: string; value: string; muted: boolean }[]
}

type Billing = 'month' | 'year'

/**
 * The page title, the monthly / yearly switch beside it, and the plan
 * cards. Strings come formatted from the page; the switch only picks which price each card shows.
 */
export function PlanCards({
  title,
  plans,
  labels,
  currentPlanId,
}: {
  title: string
  plans: PlanCardView[]
  labels: {
    billing: string
    monthly: string
    yearly: string
    badge: string
    perMonth: string
    perYear: string
    fit: string
    choose: string
    featured?: string
  }
  currentPlanId?: string | null
}) {
  const [billing, setBilling] = React.useState<Billing>('month')

  const option = (value: Billing, text: string, badge?: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={billing === value}
      onClick={() => setBilling(value)}
      className={cn(
        'flex h-10 items-center gap-2 rounded-[6px] px-4 text-[14px] font-medium transition-colors duration-160 ease-ds',
        billing === value ? 'bg-ink text-on-ink' : 'text-fg/80 hover:text-fg',
      )}
    >
      {text}
      {badge && (
        <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-semibold', billing === value ? 'bg-on-ink/15 text-on-ink' : 'bg-ok-soft text-ok')}>
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="font-serif text-[40px] font-medium leading-[1.1] tracking-[-0.02em] lg:text-[64px] lg:leading-[1.05] lg:tracking-[-0.025em]">
          {title}
        </h1>
        <div role="radiogroup" aria-label={labels.billing} className="flex self-start rounded-ctl border border-line bg-panel p-1 lg:self-auto lg:mb-2">
          {option('month', labels.monthly)}
          {option('year', labels.yearly, labels.badge)}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-3 lg:gap-5">
        {plans.map((p, i) => {
          const isCurrentPlan = currentPlanId === p.id
          return (
            <div
              key={p.id}
              data-reveal
              style={revealDelay(i * 100)}
              className={cn(
                'relative flex flex-col rounded-box border bg-panel p-6 lg:p-8 transition-all',
                isCurrentPlan
                  ? 'border-emerald-600 shadow-lg ring-2 ring-emerald-500/40'
                  : p.isFeatured
                    ? 'border-primary shadow-lg ring-1 ring-primary/40'
                    : 'border-line'
              )}
            >
              {/* Badges on top */}
              <div className="absolute -top-3.5 left-0 right-0 flex items-center justify-center gap-2 px-4 pointer-events-none">
                {isCurrentPlan && (
                  <span className="rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                    Gói hiện tại
                  </span>
                )}
                {p.isFeatured && (
                  <span className={cn(
                    'rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs',
                    isCurrentPlan && 'bg-primary/90'
                  )}>
                    {labels.featured || 'Phổ biến nhất'}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-label font-bold uppercase text-muted">{p.name}</h2>
                  {isCurrentPlan && (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                      Đang sử dụng
                    </span>
                  )}
                </div>
                {p.trialDays && !isCurrentPlan ? (
                  <span className="rounded bg-ok-soft px-2 py-0.5 text-[11px] font-semibold text-ok">
                    {p.trialDays} ngày dùng thử
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[14px] text-muted">
                {labels.fit} <span className="text-fg">{p.fit}</span>
              </p>
              {/* key: the price fades in again when the switch flips */}
              <p key={billing} className="swap-in mt-6 flex flex-wrap items-baseline gap-2">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.015em] tabular-nums">
                  {billing === 'year' ? p.yearly : p.monthly}
                </span>
                <span className="text-[14px] text-muted">
                  {billing === 'year' ? labels.perYear : labels.perMonth}
                </span>
              </p>
              {/* Same height either way, so the cards do not jump */}
              <p aria-live="polite" className="mt-2 h-5 text-[13px] font-medium text-ok">
                {billing === 'year' ? p.saving : ''}
              </p>

              {/* Action button */}
              <Link
                href={`/billing/checkout?plan=${p.id}&billing=${billing === 'year' ? 'YEAR' : 'MONTH'}`}
                className={cn(
                  isCurrentPlan
                    ? 'flex items-center justify-center rounded-ctl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-xs'
                    : p.isFeatured
                      ? 'flex items-center justify-center rounded-ctl bg-primary text-white font-medium hover:bg-primary/90 shadow-xs'
                      : inkButton,
                  'mt-5 h-12 text-[15px]'
                )}
              >
                {isCurrentPlan ? 'Gia hạn gói này' : currentPlanId ? 'Đổi sang gói này' : labels.choose}
              </Link>
              <dl className="mt-7 border-t border-line/70">
                {p.limits.map((l) => (
                  <div key={l.label} className="flex items-center justify-between gap-4 border-b border-line/70 py-3 text-[14px]">
                    <dt>{l.label}</dt>
                    <dd className={cn('font-medium tabular-nums', l.muted ? 'text-muted' : 'text-fg')}>{l.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
    </>
  )
}
