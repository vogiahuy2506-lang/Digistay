'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import fallback from '../../../messages/dash/vi/common.json'
import { useDialogBehavior, useMediaQuery } from './dialog-behavior'

/**
 * Detail panel that slides in from the right (redesign 4b / 4d).
 *
 * From `md` up it is 480 px wide and non-modal: the list behind stays usable,
 * so staff can click another row to switch. Below `md` it covers the screen and
 * behaves as a modal (focus trapped, page scroll locked). Escape closes it in
 * both cases, and focus returns to whatever opened it.
 */

interface SidePanelProps {
  open: boolean
  onClose: () => void
  /** Accessible name, e.g. "Đặt phòng MB-10249". */
  label: string
  children: React.ReactNode
  className?: string
}

const SidePanelContext = React.createContext<{ onClose: () => void } | null>(null)

/**
 * The close button's label in the page's language (dash.common.actions.close).
 * Vietnamese when there is no translation provider (the dialogs' unit tests
 * render without one) or no dashboard messages (a hotel's website).
 */
function useCloseLabel() {
  try {
    const t = useTranslations('dash.common')
    if (t.has('actions.close')) return t('actions.close')
  } catch {
    // No NextIntlClientProvider above this dialog.
  }
  return fallback.actions.close
}

export function SidePanel({ open, onClose, label, children, className }: SidePanelProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const isPhone = useMediaQuery('(max-width: 767.98px)')
  useDialogBehavior(panelRef, open, { onEscape: onClose, modal: isPhone })

  if (!open) return null

  return (
    <SidePanelContext.Provider value={{ onClose }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isPhone || undefined}
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'fixed z-40 inset-0 flex flex-col bg-raised text-fg focus:outline-none',
          'md:left-auto md:w-[480px] md:border-l md:border-line md:shadow-drawer',
          'animate-panel-in motion-reduce:animate-none',
          className
        )}
      >
        {children}
      </div>
    </SidePanelContext.Provider>
  )
}

export function SidePanelHeader({
  className,
  actions,
  children,
}: {
  className?: string
  /** Extra controls before the close button, e.g. previous / next booking. */
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const context = React.useContext(SidePanelContext)
  const closeLabel = useCloseLabel()
  return (
    <div className={cn('flex items-start gap-3 px-5 py-4 border-b border-line', className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex items-center gap-1.5 shrink-0">
        {actions}
        {context && (
          <button
            type="button"
            onClick={context.onClose}
            aria-label={closeLabel}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 flex items-center justify-center transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

export function SidePanelBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-5', className)}>{children}</div>
}

/** Stays at the bottom; holds the main action for the current state. */
export function SidePanelFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line bg-raised',
        className
      )}
    >
      {children}
    </div>
  )
}
