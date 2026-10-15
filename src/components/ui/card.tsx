'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn(
      'px-6 py-4 border-b border-gray-100',
      className
    )}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3 className={cn(
      'text-lg font-semibold text-gray-900',
      className
    )}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children }: CardProps) {
  return (
    <p className={cn(
      'text-sm text-gray-500 mt-1',
      className
    )}>
      {children}
    </p>
  )
}

export function CardContent({ className, children }: CardProps) {
  return (
    <div className={cn(
      'p-6',
      className
    )}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children }: CardProps) {
  return (
    <div className={cn(
      'px-6 py-4 border-t border-gray-100 bg-gray-50',
      className
    )}>
      {children}
    </div>
  )
}
