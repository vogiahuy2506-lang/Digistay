import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame } from '@/components/marketing/styles'
import { cn } from '@/lib/utils'

/**
 * The frame of the account pages that belong to no workspace (/workspaces,
 * /profile): the header of Digistay's home page (links, theme, VI | EN, the
 * account menu with sign out), and the content in the same frame, so both
 * line up at any width (product owner, 2026-10-27: "giống hệt trang chủ").
 */
export function AccountFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className={cn(frame, 'flex-1')}>{children}</main>
    </div>
  )
}
