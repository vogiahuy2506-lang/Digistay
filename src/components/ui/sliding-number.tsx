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
    <span className={cn('relative inline-flex h-[1.25em] w-[0.62em] overflow-hidden leading-none', className)}>
      <motion.span
        className="flex flex-col"
        initial={false}
        animate={{ y: shouldReduceMotion ? 0 : `-${digit * 10}%` }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="flex h-[1.25em] items-center justify-center tabular-nums">
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
    <span className={cn('inline-flex items-baseline font-mono tabular-nums leading-none', className)}>
      {prefix && <span className="mr-0.5 select-none">{prefix}</span>}
      {chars.map((char, i) => {
        const num = parseInt(char, 10)
        if (Number.isNaN(num)) {
          return (
            <span key={`${i}-${char}`} className="select-none">
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
