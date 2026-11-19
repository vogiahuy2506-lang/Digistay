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
  dot?: boolean
  pulse?: boolean
  children: React.ReactNode
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-small',
}

export function Badge({ variant = 'primary', size = 'sm', className, textColor, dot, pulse, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium whitespace-nowrap transition-colors duration-160',
        variants[variant],
        sizes[size],
        textColor,
        className
      )}
    >
      {(dot || pulse) && (
        <span className="relative flex h-1.5 w-1.5 mr-1.5 shrink-0">
          {pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current motion-reduce:hidden" />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      <span>{children}</span>
    </span>
  )
}

function MetaBadge({
  meta,
  label,
  size,
  dot,
  pulse,
  className,
}: {
  meta: StatusMeta
  label: string
  size?: BadgeProps['size']
  dot?: boolean
  pulse?: boolean
  className?: string
}) {
  return (
    <Badge
      variant={meta.tone}
      size={size}
      dot={dot}
      pulse={pulse}
      className={cn(meta.struck && 'line-through', className)}
    >
      {label}
    </Badge>
  )
}

/** Chip for `Booking.status` (string so API JSON can be passed straight in). */
export function BookingStatusBadge({
  status,
  dot,
  pulse,
  ...rest
}: {
  status: string
  size?: BadgeProps['size']
  dot?: boolean
  pulse?: boolean
  className?: string
}) {
  const labels = useDashLabels()
  // Active in-house stays can have a subtle pulse dot by default
  const isLive = status === 'CHECKED_IN' || status === 'CONFIRMED'
  return (
    <MetaBadge
      meta={getBookingStatusMeta(status)}
      label={labels.bookingStatus(status)}
      dot={dot ?? isLive}
      pulse={pulse ?? (status === 'CHECKED_IN')}
      {...rest}
    />
  )
}

/** Chip for `Booking.paymentStatus` and `Payment.status`. */
export function PaymentStatusBadge({
  status,
  dot,
  pulse,
  ...rest
}: {
  status: string
  size?: BadgeProps['size']
  dot?: boolean
  pulse?: boolean
  className?: string
}) {
  const labels = useDashLabels()
  const isPending = status === 'PENDING'
  return (
    <MetaBadge
      meta={getPaymentStatusMeta(status)}
      label={labels.paymentStatus(status)}
      dot={dot ?? isPending}
      pulse={pulse ?? isPending}
      {...rest}
    />
  )
}
