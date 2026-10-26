'use client'

import * as React from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LayoutGrid, LogOut, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MarketingAccountLabels {
  /** the button's name, e.g. "Tài khoản a@b.vn" */
  menu: string
  dashboard: string
  profile: string
  signOut: string
}

/** Signing out from a public page lands on the home page, like the dashboard's top bars. */
export async function signOutToHome() {
  try {
    sessionStorage.setItem('justSignedOut', 'true')
  } catch {
    // Storage blocked: nothing depends on it.
  }
  await signOut({ callbackUrl: '/' })
}

/**
 * The signed-in visitor's account on Digistay's public pages: the initials
 * and email open a small menu (dashboard, profile, sign out). Theme and
 * language stay visible in the header itself. A menu button: arrows move
 * between the entries, Escape closes it and gives focus back, a click
 * outside or Tab closes it. Labels come from the server header (the public
 * pages do not load the dashboard's messages).
 */
export function MarketingAccount({ email, labels }: { email: string; labels: MarketingAccountLabels }) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const initials = email.slice(0, 2).toUpperCase()

  const items = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  React.useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
      list[next]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      list[e.key === 'Home' ? 0 : list.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const item = 'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-fg hover:bg-fg/5 focus:bg-fg/5 focus:outline-none'

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={labels.menu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="flex h-11 items-center gap-2.5 rounded-ctl px-1.5 font-medium text-fg hover:bg-fg/5 lg:h-10"
      >
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-plain-soft text-[12px] font-semibold">
          {initials}
        </span>
        <span className="hidden max-w-[200px] truncate lg:block">{email}</span>
      </button>
      {open && (
        <div
          id={`${id}-menu`}
          role="menu"
          aria-label={labels.menu}
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-box border border-line bg-panel py-1.5 shadow-lg"
        >
          <p className="truncate px-3.5 pb-2 pt-1 text-[12px] text-muted lg:hidden">{email}</p>
          <Link role="menuitem" href="/workspaces" className={item} onClick={() => setOpen(false)}>
            <LayoutGrid className="h-4 w-4 text-muted" aria-hidden />
            {labels.dashboard}
          </Link>
          <Link role="menuitem" href="/profile" className={item} onClick={() => setOpen(false)}>
            <UserRound className="h-4 w-4 text-muted" aria-hidden />
            {labels.profile}
          </Link>
          <div className="my-1.5 border-t border-line" role="separator" />
          <button role="menuitem" type="button" className={cn(item, 'text-err')} onClick={signOutToHome}>
            <LogOut className="h-4 w-4" aria-hidden />
            {labels.signOut}
          </button>
        </div>
      )}
    </div>
  )
}

/** "Đăng xuất" inside the phone menu of the public pages. */
export function MarketingSignOutButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={signOutToHome}
      className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-ctl border border-line text-[15px] font-medium text-err"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}
