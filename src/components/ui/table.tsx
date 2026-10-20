'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TableProps {
  className?: string
  children: React.ReactNode
}

export function Table({ className, children }: TableProps) {
  return (
    <div className={cn('w-full overflow-auto', className)}>
      <table className="w-full caption-bottom text-small text-fg">{children}</table>
    </div>
  )
}

export function TableHeader({ className, children }: TableProps) {
  return <thead className={cn('border-b border-line', className)}>{children}</thead>
}

export function TableBody({ className, children }: TableProps) {
  return <tbody className={cn('divide-y divide-line', className)}>{children}</tbody>
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** The row whose details are open in the side panel: tinted, with a bar on the left. */
  selected?: boolean
}

export function TableRow({ className, selected, children, ...props }: TableRowProps) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        'transition-colors duration-160 hover:bg-fg/[0.03]',
        selected && 'bg-fg/[0.06] shadow-[inset_3px_0_0_rgb(var(--ds-fg))] hover:bg-fg/[0.06]',
        props.onClick && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TableHead({ className, children }: TableProps) {
  return <th className={cn('h-10 px-4 text-left align-middle text-small font-medium text-muted', className)}>{children}</th>
}

export function TableCell({ className, children }: TableProps) {
  return <td className={cn('px-4 py-3 align-middle text-small text-fg', className)}>{children}</td>
}
