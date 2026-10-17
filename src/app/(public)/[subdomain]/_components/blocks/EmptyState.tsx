import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A neutral, brand-agnostic empty-state card for the public site.
 *
 * Use when a block has no data yet so the page doesn't look broken
 * during the first days after a workspace is published. The card
 * uses the same tokens (`--brand-primary`, etc.) the rest of the
 * public site uses, so it blends in regardless of the workspace's
 * brand colours.
 */
export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-10 text-center',
        className
      )}
    >
      {icon && (
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' }}
        >
          <div className="text-gray-500">{icon}</div>
        </div>
      )}
      <p className="text-base font-medium text-gray-800">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
