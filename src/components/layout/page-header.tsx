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
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
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

interface TitleBlockProps {
  title: string
  lead?: string
  actions?: React.ReactNode
}

/**
 * The heading of the workspace level pages: a serif title, a plain lead line
 * and the actions on the right — the shape /workspaces uses.
 */
export function TitleBlock({ title, lead, actions }: TitleBlockProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
      <div className="max-w-xl">
        <h1 className="font-serif text-[30px] leading-[1.15] tracking-[-0.02em] text-fg sm:text-[38px]">
          {title}
        </h1>
        {lead && <p className="mt-2 text-small text-muted sm:text-body">{lead}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">{actions}</div>}
    </div>
  )
}