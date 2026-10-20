'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
  children: React.ReactNode
}

// Use focus-visible (not focus) so the ring only appears for keyboard
// navigation, not for mouse clicks — keeps the UI calm while remaining
// WCAG 2.4.7 compliant.
const baseStyles =
  // No gap: existing callers space their icons with mr-2 / ml-2 or pass gap-*.
  'inline-flex items-center justify-center rounded-ctl font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color,opacity,transform] duration-160 ease-ds active:scale-[0.98] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-page ' +
  'disabled:cursor-not-allowed disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100'

const variants = {
  // Filled buttons turn into the "Hết phòng" look when disabled (system page 1c).
  primary: 'bg-ink text-on-ink hover:bg-ink/90 disabled:bg-plain-soft disabled:text-muted',
  // Secondary actions sit on a panel; outline is the same on a transparent ground.
  secondary: 'border border-line bg-panel text-fg hover:border-muted disabled:opacity-50',
  outline: 'border border-line bg-transparent text-fg hover:border-muted disabled:opacity-50',
  ghost: 'bg-transparent text-fg hover:bg-fg/5 disabled:opacity-50',
  danger: 'bg-err text-on-err hover:bg-err/90 disabled:bg-plain-soft disabled:text-muted',
  // "Hủy đặt phòng": a destructive action that is not the main one.
  'danger-outline': 'border border-err/40 bg-transparent text-err hover:bg-err-soft disabled:opacity-50',
}

// Phones get 44 px targets (36 px for compact ones in table rows); from `sm`
// up, the denser dashboard sizes apply.
const sizes = {
  sm: 'h-9 sm:h-8 px-3 text-small',
  md: 'h-11 sm:h-9 px-4 text-small',
  lg: 'h-11 px-5 text-body',
  // Hotel website calls to action ("Đặt phòng", "Tìm phòng").
  xl: 'h-[52px] px-6 text-body',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
