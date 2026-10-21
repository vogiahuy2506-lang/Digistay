'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The header's menu below lg: a two-line button that opens a panel under the
 * header (which must be `relative`). Following a link or pressing Escape
 * closes it.
 */
export function MobileMenu({
  openLabel,
  closeLabel,
  children,
}: {
  openLabel: string
  closeLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const bar = 'h-[1.5px] w-5 bg-fg transition-transform duration-160 ease-ds motion-reduce:transition-none'
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-ctl lg:hidden"
      >
        <span className={cn(bar, open && 'translate-y-[3.75px] rotate-45')} />
        <span className={cn(bar, open && '-translate-y-[3.75px] -rotate-45')} />
      </button>
      <div
        id={id}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as Element).closest('a')) setOpen(false)
        }}
        className="absolute inset-x-0 top-full z-30 border-b border-line bg-panel px-5 pb-5 pt-2 shadow-lift lg:hidden"
      >
        {children}
      </div>
    </>
  )
}
