'use client'

import * as React from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SlidingNumberProps {
  value: number | string
  prefix?: string
  suffix?: string
  className?: string
  digitClassName?: string
}

function DigitChar({ char, className }: { char: string; className?: string }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <span
      className={cn(
        'relative inline-flex overflow-hidden tabular-nums select-none align-baseline',
        className
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={shouldReduceMotion ? false : { y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: '-100%', opacity: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  type: 'spring',
                  stiffness: 320,
                  damping: 32,
                }
          }
          className="inline-block tabular-nums"
        >
          {char}
        </motion.span>
      </AnimatePresence>
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
      aria-label={`${prefix ?? ''}${value}${suffix ?? ''}`}
    >
      {prefix && <span className="mr-0.5 select-none">{prefix}</span>}
      {chars.map((char, i) => (
        <DigitChar key={i} char={char} className={digitClassName} />
      ))}
      {suffix && <span className="ml-0.5 select-none">{suffix}</span>}
    </span>
  )
}
