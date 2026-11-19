'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

interface CollapsibleContextValue {
  open: boolean
  toggle: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const toggle = React.useCallback(() => {
    const next = !open
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }, [open, isControlled, onOpenChange])

  return (
    <CollapsibleContext.Provider value={{ open, toggle }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

export function CollapsibleTrigger({
  className,
  hideChevron,
  children,
}: {
  className?: string
  hideChevron?: boolean
  children: React.ReactNode
}) {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error('CollapsibleTrigger must be used within Collapsible')

  return (
    <button
      type="button"
      onClick={ctx.toggle}
      aria-expanded={ctx.open}
      className={cn('flex items-center justify-between w-full text-left', className)}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {!hideChevron && (
        <motion.span
          animate={{ rotate: ctx.open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="shrink-0 ml-2 text-muted"
          aria-hidden="true"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      )}
    </button>
  )
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'

export function CollapsibleContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error('CollapsibleContent must be used within Collapsible')

  return (
    <AnimatePresence initial={false}>
      {ctx.open && (
        <motion.div
          initial={isTest ? false : { height: 0, opacity: 0 }}
          animate={isTest ? undefined : { height: 'auto', opacity: 1 }}
          exit={isTest ? undefined : { height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
