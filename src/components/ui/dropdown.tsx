'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

export function Dropdown({ trigger, children, align = 'right', className }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [coords, setCoords] = React.useState<{ top: number; left?: number; right?: number; openUp: boolean } | null>(null)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < 180 && rect.top > 180

    if (align === 'right') {
      setCoords({
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        openUp,
      })
    } else {
      setCoords({
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        left: rect.left,
        openUp,
      })
    }
  }, [align])

  React.useEffect(() => {
    if (!isOpen) return
    updatePosition()

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false)
      }
    }

    const handleScrollOrResize = () => updatePosition()

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen, updatePosition])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isOpen && event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div className="relative inline-block" ref={triggerRef} onKeyDown={handleKeyDown}>
      <div
        onClick={() => {
          if (!isOpen) updatePosition()
          setIsOpen(!isOpen)
        }}
      >
        {trigger}
      </div>

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              right: coords.right,
              transform: coords.openUp ? 'translateY(-100%)' : undefined,
            }}
            className={cn(
              'z-[100] min-w-[200px] py-1 bg-raised text-fg rounded-box border border-line shadow-lift',
              className
            )}
            onKeyDown={handleKeyDown}
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
          </div>,
          document.body
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
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-small text-left transition-colors duration-160',
        disabled && 'opacity-50 cursor-not-allowed',
        danger ? 'text-err hover:bg-err-soft' : 'text-fg hover:bg-fg/5',
        className
      )}
    >
      {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

export function DropdownDivider() {
  return <div role="separator" className="my-1 border-t border-line" />
}
