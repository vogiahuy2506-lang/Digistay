'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SlidingNumberProps {
  value: number | string
  prefix?: string
  suffix?: string
  className?: string
  digitClassName?: string
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function DigitColumn({ digit, className }: { digit: number; className?: string }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <span
      className={cn(
        'relative inline-flex overflow-hidden tabular-nums select-none align-baseline',
        className
      )}
      style={{ height: '1.2em', lineHeight: '1.2em' }}
      aria-hidden="true"
    >
      {/* Invisible placeholder that sets exact width and baseline of the digit */}
      <span
        className="invisible select-none pointer-events-none flex items-center justify-center"
        aria-hidden="true"
        style={{ height: '1.2em', lineHeight: '1.2em' }}
      >
        {digit}
      </span>

      {/* Sliding reel of 10 digits */}
      <motion.span
        className="absolute left-0 top-0 w-full flex flex-col items-center"
        initial={false}
        animate={{ y: `-${digit * 1.2}em` }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                type: 'spring',
                stiffness: 280,
                damping: 28,
              }
        }
        style={{ height: '12em' }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            className="flex w-full shrink-0 items-center justify-center tabular-nums"
            style={{ height: '1.2em', lineHeight: '1.2em' }}
          >
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function SlidingNumber({
  value,
  prefix,
  suffix,
  className,
  digitClassName,
}: SlidingNumberProps) {
  const chars = String(value).split('')

  return (
    <span
      className={cn('inline-flex items-baseline tabular-nums', className)}
      style={{ lineHeight: '1.2em' }}
      aria-label={`${prefix ?? ''}${value}${suffix ?? ''}`}
    >
      {prefix && <span className="mr-0.5 select-none">{prefix}</span>}
      {chars.map((char, i) => {
        const num = parseInt(char, 10)
        if (Number.isNaN(num)) {
          return (
            <span
              key={`${i}-${char}`}
              className="select-none inline-flex items-center"
              style={{ height: '1.2em', lineHeight: '1.2em' }}
            >
              {char}
            </span>
          )
        }
        return <DigitColumn key={i} digit={num} className={digitClassName} />
      })}
      {suffix && <span className="ml-0.5 select-none">{suffix}</span>}
    </span>
  )
}
