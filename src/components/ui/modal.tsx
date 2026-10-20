'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useDialogBehavior } from './dialog-behavior'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  /** Accessible name when the modal has no ModalHeader. */
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-2xl',
  /** wide forms with two columns (the calendar's create-booking dialog) */
  full: 'max-w-6xl',
}

// ModalHeader registers its id so the dialog is named by its header text.
const ModalLabelContext = React.createContext<string | undefined>(undefined)

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const labelId = React.useId()
  useDialogBehavior(dialogRef, isOpen, { onEscape: onClose, modal: true })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby={title ? undefined : labelId}
        tabIndex={-1}
        // overflow-y-auto, not hidden: most dialogs put their content straight
        // in here (no ModalBody), and a tall one lost its footer buttons below
        // the 92vh limit with no way to scroll to them. With ModalBody the body
        // scrolls and header / footer stay in view, as before.
        className={cn(
          'relative bg-raised text-fg rounded-box border border-line shadow-lift w-full max-h-[92vh] flex flex-col z-10 overflow-y-auto overscroll-contain focus:outline-none',
          sizes[size]
        )}
      >
        <ModalLabelContext.Provider value={labelId}>{children}</ModalLabelContext.Provider>
      </div>
    </div>
  )
}

export function ModalHeader({
  className,
  children,
  onClose,
}: {
  className?: string
  children: React.ReactNode
  onClose?: () => void
}) {
  const labelId = React.useContext(ModalLabelContext)
  return (
    <div className={cn('px-6 py-4 border-b border-line flex items-center justify-between gap-3', className)}>
      <div id={labelId} className="flex items-center gap-3 min-w-0">
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="w-8 h-8 shrink-0 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 flex items-center justify-center transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function ModalBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-6 overflow-y-auto space-y-5 text-left', className)}>{children}</div>
}

export function ModalFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'px-6 py-4 bg-page/60 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3',
        className
      )}
    >
      {children}
    </div>
  )
}
