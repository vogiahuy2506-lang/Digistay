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
      <table className="w-full caption-bottom text-sm">
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className, children }: TableProps) {
  return <thead className={cn('border-b border-gray-200 bg-gray-50', className)}>{children}</thead>
}

export function TableBody({ className, children }: TableProps) {
  return <tbody className={cn('divide-y divide-gray-100', className)}>{children}</tbody>
}

export function TableRow({ className, children }: TableProps) {
  return <tr className={cn('hover:bg-gray-50 transition-colors', className)}>{children}</tr>
}

export function TableHead({ className, children }: TableProps) {
  return <th className={cn('px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider', className)}>{children}</th>
}

export function TableCell({ className, children }: TableProps) {
  return <td className={cn('px-4 py-3 text-sm text-gray-700', className)}>{children}</td>
}
