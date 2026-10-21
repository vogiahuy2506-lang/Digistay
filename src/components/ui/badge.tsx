'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { getBookingStatusMeta, getPaymentStatusMeta, type StatusMeta, type StatusTone } from '@/lib/booking-status'
import { useDashLabels } from '@/lib/i18n/dash'

const tones: Record<StatusTone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  err: 'bg-err-soft text-err',
  info: 'bg-info-soft text-info',
  refund: 'bg-refund-soft text-refund',
  plain: 'bg-plain-soft text-plain',
}

const variants = {
  ...tones,
  acc: 'bg-acc-soft text-acc',
  outline: 'border border-line text-muted bg-transparent',
  // Older names, kept until every caller uses the tones above.
  primary: 'bg-acc-soft text-acc',
  secondary: 'bg-info-soft text-info',
  success: 'bg-ok-soft text-ok',
  warning: 'bg-warn-soft text-warn',
  danger: 'bg-err-soft text-err',
  gray: 'bg-plain-soft text-plain',
}

interface BadgeProps {
  variant?: keyof typeof variants
  size?: 'sm' | 'md'
  className?: string
  textColor?: string
  children: React.ReactNode
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-small',
}

export function Badge({ variant = 'primary', size = 'sm', className, textColor, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium whitespace-nowrap',
        variants[variant],
        sizes[size],
        textColor,
        className
      )}
    >
      {children}
    </span>
  )
}

function MetaBadge({ meta, label, size, className }: { meta: StatusMeta; label: string; size?: BadgeProps['size']; className?: string }) {
  return (
    <Badge variant={meta.tone} size={size} className={cn(meta.struck && 'line-through', className)}>
      {label}
    </Badge>
  )
}

/** Chip for `Booking.status` (string so API JSON can be passed straight in). */
export function BookingStatusBadge({ status, ...rest }: { status: string; size?: BadgeProps['size']; className?: string }) {
  const labels = useDashLabels()
  return <MetaBadge meta={getBookingStatusMeta(status)} label={labels.bookingStatus(status)} {...rest} />
}

/** Chip for `Booking.paymentStatus` and `Payment.status`. */
export function PaymentStatusBadge({ status, ...rest }: { status: string; size?: BadgeProps['size']; className?: string }) {
  const labels = useDashLabels()
  return <MetaBadge meta={getPaymentStatusMeta(status)} label={labels.paymentStatus(status)} {...rest} />
}
