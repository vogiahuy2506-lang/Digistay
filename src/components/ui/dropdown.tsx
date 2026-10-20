'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

export function Dropdown({ trigger, children, align = 'right', className }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Escape closes only the menu: preventDefault tells an enclosing Modal or
  // SidePanel (see dialog-behavior.ts) to leave this key alone.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isOpen && event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-2 min-w-[200px] py-1 bg-raised text-fg rounded-box border border-line shadow-lift',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement<{ onClick?: () => void }>(child)) {
              return React.cloneElement(child, {
                onClick: () => {
                  setIsOpen(false)
                  child.props.onClick?.()
                },
              })
            }
            return child
          })}
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps {
  children: React.ReactNode
  onClick?: () => void
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  className?: string
}

export function DropdownItem({ children, onClick, icon, danger, disabled, className }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full h-10 sm:h-9 px-3 text-small text-left flex items-center gap-3 transition-colors duration-160',
        'focus:outline-none',
        danger ? 'text-err hover:bg-err-soft focus-visible:bg-err-soft' : 'text-fg hover:bg-fg/5 focus-visible:bg-fg/5',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {icon && <span className="w-4 h-4 shrink-0">{icon}</span>}
      {children}
    </button>
  )
}

export function DropdownDivider() {
  return <div role="separator" className="my-1 border-t border-line" />
}
