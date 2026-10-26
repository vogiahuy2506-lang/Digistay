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
  limits: { label: string; value: string; muted: boolean }[]
}

type Billing = 'month' | 'year'

/**
 * The page title, the monthly / yearly switch beside it, and the three plan
 * cards (Claude Design "Digistay Bang Gia"). Strings come formatted from the
 * page; the switch only picks which price each card shows.
 */
export function PlanCards({
  title,
  plans,
  labels,
}: {
  title: string
  plans: PlanCardView[]
  labels: { billing: string; monthly: string; yearly: string; badge: string; perMonth: string; perYear: string; fit: string; choose: string }
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
        {plans.map((p, i) => (
          <div key={p.id} data-reveal style={revealDelay(i * 100)} className="flex flex-col rounded-box border border-line bg-panel p-6 lg:p-8">
            <h2 className="text-label font-medium uppercase text-muted">{p.name}</h2>
            <p className="mt-2 text-[14px] text-muted">
              {labels.fit} <span className="text-fg">{p.fit}</span>
            </p>
            {/* key: the price fades in again when the switch flips */}
            <p key={billing} className="swap-in mt-6 flex flex-wrap items-baseline gap-2">
              <span className="text-[34px] font-semibold leading-none tracking-[-0.015em] tabular-nums">{billing === 'year' ? p.yearly : p.monthly}</span>
              <span className="text-[14px] text-muted">{billing === 'year' ? labels.perYear : labels.perMonth}</span>
            </p>
            {/* Same height either way, so the cards do not jump */}
            <p aria-live="polite" className="mt-2 h-5 text-[13px] font-medium text-ok">
              {billing === 'year' ? p.saving : ''}
            </p>
            {/* Signs up first when needed, then opens the plan's QR (/billing/start). */}
            <Link href={`/billing/start?plan=${p.id}&billing=${billing === 'year' ? 'YEAR' : 'MONTH'}`} className={cn(inkButton, 'mt-5 h-12 text-[15px]')}>
              {labels.choose}
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
        ))}
      </div>
    </>
  )
}
