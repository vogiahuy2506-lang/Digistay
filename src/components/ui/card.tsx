'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
}

// Flat panels: depth comes from the panel/page contrast and a 1 px line, not a shadow.
export function Card({ className, children }: CardProps) {
  return (
    <div className={cn('bg-panel text-fg rounded-box border border-line overflow-hidden', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn('px-6 py-4 border-b border-line', className)}>{children}</div>
}

export function CardTitle({ className, children }: CardProps) {
  return <h3 className={cn('text-base font-semibold text-fg', className)}>{children}</h3>
}

export function CardDescription({ className, children }: CardProps) {
  return <p className={cn('text-small text-muted mt-1', className)}>{children}</p>
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn('p-6', className)}>{children}</div>
}

export function CardFooter({ className, children }: CardProps) {
  return <div className={cn('px-6 py-4 border-t border-line bg-page/60', className)}>{children}</div>
}
