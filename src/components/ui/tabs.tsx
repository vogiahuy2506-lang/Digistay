'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

type TabsVariant = 'segmented' | 'underline'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  baseId: string
}

const TabsContext = React.createContext<TabsContextValue | null>(null)
const TabsVariantContext = React.createContext<TabsVariant>('segmented')

export function Tabs({ defaultValue, value: controlledValue, onValueChange, children, className }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || '')
  const baseId = React.useId()

  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : uncontrolledValue

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

const listStyles: Record<TabsVariant, string> = {
  // Scrolls sideways when the tabs are wider than a phone.
  segmented: 'inline-flex max-w-full items-center gap-1 overflow-x-auto p-1 bg-plain-soft rounded-ctl',
  // Bookings filter row (redesign 4a): text tabs over a 1 px line, scrolls sideways on phones.
  underline: 'flex items-end gap-6 border-b border-line overflow-x-auto',
}

export function TabsList({
  className,
  variant = 'segmented',
  children,
}: {
  className?: string
  variant?: TabsVariant
  children: React.ReactNode
}) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <div role="tablist" className={cn(listStyles[variant], className)}>
        {children}
      </div>
    </TabsVariantContext.Provider>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

const triggerStyles: Record<TabsVariant, { base: string; active: string; idle: string }> = {
  segmented: {
    base: 'px-3 h-9 sm:h-8 text-small font-medium whitespace-nowrap shrink-0 rounded-[calc(var(--ds-r-ctl)-2px)]',
    active: 'bg-panel text-fg shadow-sm',
    idle: 'text-muted hover:text-fg',
  },
  underline: {
    base: 'h-10 -mb-px border-b-2 px-0.5 text-small font-medium whitespace-nowrap',
    active: 'border-fg text-fg',
    idle: 'border-transparent text-muted hover:text-fg',
  },
}

export function TabsTrigger({ value, children, className, disabled }: TabsTriggerProps) {
  const context = React.useContext(TabsContext)
  const variant = React.useContext(TabsVariantContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')

  const isActive = context.value === value
  const styles = triggerStyles[variant]

  return (
    <button
      type="button"
      role="tab"
      id={`${context.baseId}-tab-${value}`}
      aria-selected={isActive}
      // Only the active panel is rendered, so only the active tab points at one.
      aria-controls={isActive ? `${context.baseId}-panel-${value}` : undefined}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => !disabled && context.onValueChange(value)}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center transition-colors duration-160 ease-ds',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-page',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        styles.base,
        isActive ? styles.active : styles.idle,
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')

  if (context.value !== value) return null

  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-panel-${value}`}
      aria-labelledby={`${context.baseId}-tab-${value}`}
      className={cn('mt-4', className)}
    >
      {children}
    </div>
  )
}
