import { cookies } from 'next/headers'
import { THEME_COOKIE, parseThemePreference } from '@/lib/theme'
import { MarketingFooter } from './MarketingFooter'
import { RevealObserver } from './Reveal'

/** The visitor's light / dark choice (the dashboard's cookie), for the first paint. */
export async function publicTheme() {
  return parseThemePreference((await cookies()).get(THEME_COOKIE)?.value)
}

/**
 * Root of Digistay's own public pages (marketing, sign-in, invitations,
 * 404): the theme for the whole page and the footer. The pages use role
 * colors only (src/styles/tokens.ts), so both themes work; ThemeToggle
 * flips data-theme here. `bare`: no footer (the sign-in pages fill the
 * screen with their own frame).
 */
export async function PublicFrame({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <div data-public-theme data-theme={await publicTheme()} className="flex min-h-screen flex-col bg-page font-sans text-fg dark:[color-scheme:dark]">
      <div className="flex-1">{children}</div>
      {!bare && <MarketingFooter />}
      <RevealObserver />
    </div>
  )
}
