'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { saveThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * Light / dark on Digistay's public pages. Same choice as the dashboard's
 * (THEME_COOKIE, src/lib/theme.ts): switches the page at once by setting
 * data-theme on PublicFrame's root, and the cookie keeps it for the next
 * page and the server's first paint.
 */
export function ThemeToggle({ initial, toDark, toLight, className }: { initial: ThemePreference; toDark: string; toLight: string; className?: string }) {
  const [theme, setTheme] = React.useState(initial)
  const dark = theme === 'dark'
  const toggle = () => {
    const next: ThemePreference = dark ? 'light' : 'dark'
    saveThemePreference(next)
    document.querySelectorAll<HTMLElement>('[data-public-theme]').forEach((el) => (el.dataset.theme = next))
    setTheme(next)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? toLight : toDark}
      title={dark ? toLight : toDark}
      className={cn('flex h-10 w-10 items-center justify-center rounded-ctl text-fg transition-colors duration-160 hover:bg-fg/5', className)}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" aria-hidden /> : <Moon className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  )
}
