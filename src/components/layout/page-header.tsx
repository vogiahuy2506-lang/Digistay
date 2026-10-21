import * as React from 'react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  description?: string
  /** Small line above the title, e.g. today's date on the bookings page. */
  eyebrow?: string
  actions?: React.ReactNode
}

export function Header({ title, description, eyebrow, actions }: HeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 shrink-0">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-small text-muted mb-0.5">{eyebrow}</p>}
        <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-small text-muted">{description}</p>}
      </div>
      {/* Pages pass their own row of controls: it wraps too, so a long one never pushes the page sideways. */}
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end [&>div]:flex-wrap sm:[&>div]:justify-end">{actions}</div>
      )}
    </div>
  )
}

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn('px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto', className)}>{children}</div>
}
