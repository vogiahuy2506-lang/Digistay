'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'gray' | 'outline'
  size?: 'sm' | 'md'
  className?: string
  textColor?: string
  children: React.ReactNode
}

export function Badge({ 
  variant = 'primary', 
  size = 'sm', 
  className, 
  textColor,
  children 
}: BadgeProps) {
  const variants = {
    primary: 'bg-primary-100 text-primary-700',
    secondary: 'bg-secondary-100 text-secondary-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
    outline: 'border border-gray-300 text-gray-700 bg-transparent',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      variants[variant],
      sizes[size],
      textColor,
      className
    )}>
      {children}
    </span>
  )
}
