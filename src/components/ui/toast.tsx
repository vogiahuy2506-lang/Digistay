'use client'

import * as React from 'react'
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

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function Toast({ type = 'info', title, message, onClose }: ToastProps & { onClose: () => void }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  }

  const backgrounds = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  }

  return (
    <div className={cn(
      'rounded-lg border p-4 shadow-lg animate-slide-up',
      backgrounds[type]
    )}>
      <div className="flex gap-3">
        {icons[type]}
        <div className="flex-1">
          <p className="font-medium text-gray-900">{title}</p>
          {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded">
          <X className="w-4 h-4 text-gray-400" />
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
