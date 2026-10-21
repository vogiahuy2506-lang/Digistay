'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CompareGroupView {
  title: string
  rows: { label: string; cells: (string | boolean)[] }[]
}

/**
 * The comparison table on phones: pick one plan, see its column
 * (Claude Design "Digistay Bang Gia", mobile). Strings come from the page.
 */
export function ComparePicker({
  plans,
  groups,
  label,
  yes,
  no,
}: {
  plans: string[]
  groups: CompareGroupView[]
  label: string
  yes: string
  no: string
}) {
  const [plan, setPlan] = React.useState(0)
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-box border border-line bg-panel p-1">
        {plans.map((name, i) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={plan === i}
            onClick={() => setPlan(i)}
            className={cn(
              'h-11 flex-1 rounded-ctl text-[13.5px] font-medium transition-colors duration-160 ease-ds',
              plan === i ? 'bg-ink text-on-ink' : 'text-muted hover:text-fg',
            )}
          >
            {name}
          </button>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.title} className="mt-6">
          <h3 className="text-label font-semibold uppercase text-muted">{g.title}</h3>
          <ul className="mt-1">
            {g.rows.map((r) => {
              const cell = r.cells[plan]
              return (
                <li key={r.label} className="flex items-center justify-between gap-4 border-b border-line/70 py-3.5 text-[14.5px]">
                  <span>{r.label}</span>
                  <CompareCell value={cell} yes={yes} no={no} />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** ✓, — or the plan's limit ("100/tháng"). */
export function CompareCell({ value, yes, no }: { value: string | boolean; yes: string; no: string }) {
  if (value === true)
    return (
      <span className="text-[15px] text-fg" title={yes}>
        <span aria-hidden>✓</span>
        <span className="sr-only">{yes}</span>
      </span>
    )
  if (value === false)
    return (
      <span className="text-muted" title={no}>
        <span aria-hidden>—</span>
        <span className="sr-only">{no}</span>
      </span>
    )
  return <span className="whitespace-nowrap text-[13.5px] font-medium tabular-nums text-fg">{value}</span>
}
