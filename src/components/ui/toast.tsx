'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react'

interface ToastProps {
  id: string
  type?: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toasts: ToastProps[]
  addToast: (toast: Omit<ToastProps, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const addToast = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { ...toast, id }])

    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, toast.duration || 5000)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Bridge: the convenience `toast.success/error/...` helpers
  // dispatch a `CustomEvent('toast', …)` on `window` so any module
  // (including non-React code) can fire a toast without having to
  // import the React context. We listen for it here and forward to
  // `addToast`.
  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail && typeof detail === 'object' && 'title' in detail) {
        addToast(detail as Omit<ToastProps, 'id'>)
      }
    }
    window.addEventListener('toast', handler)
    return () => window.removeEventListener('toast', handler)
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  // Above modals (z-50) so a save confirmation is not hidden behind one.
  // Full width with a gutter on phones, bottom-right card from `sm` up.
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-full sm:max-w-md"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

const icons = {
  success: <CheckCircle className="w-5 h-5 text-ok" aria-hidden="true" />,
  error: <XCircle className="w-5 h-5 text-err" aria-hidden="true" />,
  warning: <AlertCircle className="w-5 h-5 text-warn" aria-hidden="true" />,
  info: <Info className="w-5 h-5 text-info" aria-hidden="true" />,
}

function Toast({ type = 'info', title, message, onClose }: ToastProps & { onClose: () => void }) {
  const t = useTranslations('dash.ui.toast')
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-box border border-line bg-raised text-fg p-4 shadow-lift',
        'animate-toast-in motion-reduce:animate-none'
      )}
    >
      <div className="flex gap-3">
        <span className="shrink-0">{icons[type]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-fg">{title}</p>
          {message && <p className="mt-1 text-small text-muted">{message}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="p-1 h-7 w-7 shrink-0 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// Convenience functions
export const toast = {
  success: (title: string, message?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', title, message } }))
    }
  },
  error: (title: string, message?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', title, message } }))
    }
  },
  warning: (title: string, message?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'warning', title, message } }))
    }
  },
  info: (title: string, message?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', title, message } }))
    }
  },
}
