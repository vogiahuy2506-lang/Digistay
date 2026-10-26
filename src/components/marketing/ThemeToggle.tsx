'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { saveThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/layout/theme-root'

/**
 * Light / dark on Digistay's public pages (and the account pages that use
 * their header, account-frame.tsx). Same choice as the dashboard's
 * (THEME_COOKIE, src/lib/theme.ts): switches the page at once by setting
 * data-theme on PublicFrame's root, and the cookie keeps it for the next
 * page and the server's first paint.
 */
export function ThemeToggle({
  initial,
  toDark,
  toLight,
  className,
  withLabel = false,
}: {
  initial: ThemePreference
  toDark: string
  toLight: string
  className?: string
  /** The action written next to the icon (a menu row) instead of an icon button. */
  withLabel?: boolean
}) {
  const [theme, setTheme] = React.useState(initial)
  // Inside the dashboard (the account pages use this header): its ThemeRoot follows too.
  const root = useTheme()
  const dark = theme === 'dark'
  const toggle = () => {
    const next: ThemePreference = dark ? 'light' : 'dark'
    saveThemePreference(next)
    document.querySelectorAll<HTMLElement>('[data-public-theme]').forEach((el) => (el.dataset.theme = next))
    root?.setPreference(next)
    setTheme(next)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={withLabel ? undefined : dark ? toLight : toDark}
      title={withLabel ? undefined : dark ? toLight : toDark}
      className={cn(
        withLabel
          ? 'flex w-full items-center gap-3 text-left text-fg transition-colors duration-160 hover:bg-fg/5'
          : 'flex h-10 w-10 items-center justify-center rounded-ctl text-fg transition-colors duration-160 hover:bg-fg/5',
        className
      )}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" aria-hidden /> : <Moon className="h-[18px] w-[18px]" aria-hidden />}
      {withLabel && <span>{dark ? toLight : toDark}</span>}
    </button>
  )
}
