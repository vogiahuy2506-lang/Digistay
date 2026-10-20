'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning'
}

const variants = {
  default: 'bg-info-soft border-info/20 text-info',
  destructive: 'bg-err-soft border-err/20 text-err',
  success: 'bg-ok-soft border-ok/20 text-ok',
  warning: 'bg-warn-soft border-warn/20 text-warn',
}

export function Alert({ className, variant = 'default', children, ...props }: AlertProps) {
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn('rounded-ctl border p-4', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {}

export function AlertDescription({ className, children, ...props }: AlertDescriptionProps) {
  return (
    <div className={cn('text-small', className)} {...props}>
      {children}
    </div>
  )
}

// Alert icon helper
export function AlertIcon({ variant }: { variant?: 'default' | 'destructive' | 'success' | 'warning' }) {
  const icons = {
    default: Info,
    destructive: XCircle,
    success: CheckCircle,
    warning: AlertCircle,
  }
  const Icon = icons[variant || 'default']
  return <Icon className="h-4 w-4 mr-2 inline" aria-hidden="true" />
}
