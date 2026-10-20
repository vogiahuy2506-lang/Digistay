'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { effectiveTheme, isDarkReady, saveThemePreference, type ThemePreference } from '@/lib/theme'

interface ThemeContextValue {
  preference: ThemePreference
  /** False on pages that still hard-code light colors. */
  darkAvailable: boolean
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function useTheme() {
  return React.useContext(ThemeContext)
}

/**
 * Root of every dashboard page: sets data-theme / data-surface for the whole
 * subtree (toasts and dialogs included, since they render inside it) and the
 * dashboard's base colors and font.
 */
export function ThemeRoot({ initial, children }: { initial: ThemePreference; children: React.ReactNode }) {
  const pathname = usePathname()
  const [preference, setPreferenceState] = React.useState(initial)

  const setPreference = React.useCallback((next: ThemePreference) => {
    saveThemePreference(next)
    setPreferenceState(next)
  }, [])

  const value = React.useMemo(
    () => ({ preference, darkAvailable: isDarkReady(pathname), setPreference }),
    [preference, pathname, setPreference]
  )

  return (
    <ThemeContext.Provider value={value}>
      <div
        data-theme={effectiveTheme(preference, pathname)}
        data-surface="admin"
        className="min-h-screen bg-page text-fg font-sans"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
