'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X, Building2 } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children, 
  size = 'md' 
}: ModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={cn(
        'relative bg-white rounded-2xl shadow-2xl border border-sand-200 w-full max-h-[92vh] flex flex-col z-10 overflow-hidden transform transition-all',
        sizes[size]
      )}>
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ 
  className, 
  children, 
  onClose 
}: { 
  className?: string; 
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div className={cn(
      'px-6 py-4 border-b border-sand-200/90 flex items-center justify-between bg-gradient-to-r from-sand-50/90 via-white to-sand-50/60',
      className
    )}>
      <div className="flex items-center gap-3">
        {children}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sand-100 flex items-center justify-center transition border border-transparent hover:border-sand-200"
        >
          <X className="w-4 h-4" />
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
    <div className={cn(
      'px-6 py-4 bg-sand-50/90 border-t border-sand-200/90 flex flex-col sm:flex-row items-center justify-between gap-3',
      className
    )}>
      {children}
    </div>
  )
}
