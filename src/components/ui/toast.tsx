'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface ToastAction {
  label: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  primary?: boolean
}

export interface ToastOptions {
  id?: string
  message?: string
  duration?: number // ms (0 = persistent / won't auto-dismiss)
  action?: ToastAction
  cancel?: ToastAction
  onDismiss?: () => void
}

export interface ToastItem extends ToastOptions {
  id: string
  type: ToastType
  title: string
  createdAt: number
  isExiting?: boolean
}

interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id' | 'createdAt'> & { id?: string }) => string
  updateToast: (id: string, updates: Partial<Omit<ToastItem, 'id'>>) => void
  removeToast: (id: string) => void
  dismissAll: () => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const MAX_VISIBLE_TOASTS = 4

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    )
  }, [])

  const dismissAll = React.useCallback(() => {
    setToasts((prev) => prev.map((t) => ({ ...t, isExiting: true })))
  }, [])

  const updateToast = React.useCallback((id: string, updates: Partial<Omit<ToastItem, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, isExiting: false } : t))
    )
  }, [])

  const addToast = React.useCallback((toastProps: Omit<ToastItem, 'id' | 'createdAt'> & { id?: string }) => {
    const id = toastProps.id || Math.random().toString(36).substring(7)
    const createdAt = Date.now()

    setToasts((prev) => {
      const existingIdx = prev.findIndex((t) => t.id === id)
      if (existingIdx >= 0) {
        const next = [...prev]
        next[existingIdx] = {
          ...prev[existingIdx],
          ...toastProps,
          id,
          createdAt,
          isExiting: false,
        }
        return next
      }

      // If exceeding max visible toasts, mark oldest non-exiting as exiting
      let list = prev
      const nonExiting = prev.filter((t) => !t.isExiting)
      if (nonExiting.length >= MAX_VISIBLE_TOASTS) {
        const oldest = nonExiting[0]
        list = prev.map((t) => (t.id === oldest.id ? { ...t, isExiting: true } : t))
      }

      return [...list, { ...toastProps, id, createdAt, isExiting: false }]
    })

    return id
  }, [])

  // Auto clean up exiting toasts after 220ms exit animation
  React.useEffect(() => {
    const exiting = toasts.filter((t) => t.isExiting)
    if (exiting.length === 0) return

    const timers = exiting.map((item) =>
      window.setTimeout(() => {
        try {
          item.onDismiss?.()
        } catch {}
        setToasts((prev) => prev.filter((t) => t.id !== item.id))
      }, 220)
    )

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [toasts])

  // Event Bridge: listen for CustomEvent('toast', ...) so toasts can be dispatched anywhere
  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!detail || typeof detail !== 'object') return

      if (detail.action === 'dismiss') {
        if (detail.id) removeToast(detail.id)
        else dismissAll()
      } else if (detail.action === 'update' && detail.id) {
        updateToast(detail.id, detail.updates)
      } else if ('title' in detail) {
        addToast(detail as Omit<ToastItem, 'id' | 'createdAt'>)
      }
    }

    window.addEventListener('toast', handler)
    return () => window.removeEventListener('toast', handler)
  }, [addToast, updateToast, removeToast, dismissAll])

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, removeToast, dismissAll }}>
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
  const [isDark, setIsDark] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  // Sync theme with nearest page data-theme
  React.useEffect(() => {
    const checkTheme = () => {
      const darkEl = document.querySelector('[data-theme="dark"]')
      setIsDark(!!darkEl)
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      data-theme={isDark ? 'dark' : undefined}
      aria-live="polite"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-[9999] flex flex-col gap-2.5 sm:w-full sm:max-w-md pointer-events-none"
    >
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastItemComponent
            toast={item}
            isHovered={isHovered}
            onClose={() => removeToast(item.id)}
          />
        </div>
      ))}
    </div>
  )
}

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-ok shrink-0 mt-0.5" aria-hidden="true" />,
  error: <AlertCircle className="w-5 h-5 text-err shrink-0 mt-0.5" aria-hidden="true" />,
  warning: <AlertTriangle className="w-5 h-5 text-warn shrink-0 mt-0.5" aria-hidden="true" />,
  info: <Info className="w-5 h-5 text-info shrink-0 mt-0.5" aria-hidden="true" />,
  loading: <Loader2 className="w-5 h-5 text-acc animate-spin shrink-0 mt-0.5" aria-hidden="true" />,
}

function ToastItemComponent({
  toast,
  isHovered,
  onClose,
}: {
  toast: ToastItem
  isHovered: boolean
  onClose: () => void
}) {
  const { type = 'info', title, message, duration, action, isExiting } = toast

  let closeLabel = 'Đóng'
  try {
    const tc = useTranslations('common')
    closeLabel = tc('close')
  } catch {}

  // Auto-dismiss management
  const timeoutDuration = duration !== undefined ? duration : type === 'loading' ? 0 : type === 'error' ? 5000 : 4000

  React.useEffect(() => {
    if (timeoutDuration === 0 || isExiting || isHovered) return

    const timer = window.setTimeout(() => {
      onClose()
    }, timeoutDuration)

    return () => window.clearTimeout(timer)
  }, [timeoutDuration, isExiting, isHovered, onClose])

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-box border border-line bg-raised p-4 text-fg shadow-lift transition-all duration-200',
        isExiting ? 'animate-toast-out pointer-events-none' : 'animate-toast-in'
      )}
    >
      <span className="shrink-0">{icons[type]}</span>
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-sm font-medium text-fg leading-snug">{title}</p>
        {message && (
          <p className="mt-1 text-xs text-muted leading-relaxed whitespace-pre-line">{message}</p>
        )}
        {action && (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                action.onClick(e)
                onClose()
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-ctl transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
                action.primary
                  ? 'bg-acc text-on-acc hover:bg-acc/90 shadow-sm'
                  : 'bg-fg/5 text-fg hover:bg-fg/10 border border-line'
              )}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="p-1 h-6 w-6 -mr-1 -mt-1 shrink-0 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  )
}

function normalizeOptions(messageOrOptions?: string | ToastOptions): ToastOptions {
  if (!messageOrOptions) return {}
  if (typeof messageOrOptions === 'string') return { message: messageOrOptions }
  return messageOrOptions
}

// Convenience helper functions
export const toast = {
  success: (title: string, messageOrOptions?: string | ToastOptions): string => {
    const opts = normalizeOptions(messageOrOptions)
    const id = opts.id || Math.random().toString(36).substring(7)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { ...opts, id, type: 'success', title },
        })
      )
    }
    return id
  },
  error: (title: string, messageOrOptions?: string | ToastOptions): string => {
    const opts = normalizeOptions(messageOrOptions)
    const id = opts.id || Math.random().toString(36).substring(7)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { ...opts, id, type: 'error', title },
        })
      )
    }
    return id
  },
  warning: (title: string, messageOrOptions?: string | ToastOptions): string => {
    const opts = normalizeOptions(messageOrOptions)
    const id = opts.id || Math.random().toString(36).substring(7)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { ...opts, id, type: 'warning', title },
        })
      )
    }
    return id
  },
  info: (title: string, messageOrOptions?: string | ToastOptions): string => {
    const opts = normalizeOptions(messageOrOptions)
    const id = opts.id || Math.random().toString(36).substring(7)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { ...opts, id, type: 'info', title },
        })
      )
    }
    return id
  },
  loading: (title: string, messageOrOptions?: string | ToastOptions): string => {
    const opts = normalizeOptions(messageOrOptions)
    const id = opts.id || Math.random().toString(36).substring(7)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { duration: 0, ...opts, id, type: 'loading', title },
        })
      )
    }
    return id
  },
  dismiss: (id?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { action: 'dismiss', id },
        })
      )
    }
  },
  promise: async function <T>(
    promise: Promise<T> | (() => Promise<T>),
    msgs: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: unknown) => string)
    },
    options?: ToastOptions
  ): Promise<T> {
    const id = options?.id || Math.random().toString(36).substring(7)
    toast.loading(msgs.loading, { ...options, id })
    try {
      const p = typeof promise === 'function' ? promise() : promise
      const data = await p
      const successTitle = typeof msgs.success === 'function' ? msgs.success(data) : msgs.success
      toast.success(successTitle, { ...options, id })
      return data
    } catch (err) {
      const errorTitle = typeof msgs.error === 'function' ? msgs.error(err) : msgs.error
      toast.error(errorTitle, { ...options, id })
      throw err
    }
  },
}
