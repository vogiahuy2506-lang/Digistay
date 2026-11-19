'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedCheckmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: string
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
}

export function AnimatedCheckmark({ size = 'md', className, color = 'currentColor' }: AnimatedCheckmarkProps) {
  return (
    <motion.svg
      className={cn(sizeMap[size], className)}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <motion.circle
        cx="26"
        cy="26"
        r="23"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
      <motion.path
        d="M15 26.5l7.5 7.5 15-15"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, delay: 0.2, ease: 'easeOut' }}
      />
    </motion.svg>
  )
}
