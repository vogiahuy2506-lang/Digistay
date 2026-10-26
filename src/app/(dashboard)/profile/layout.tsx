import { AccountTopBar } from '@/app/(dashboard)/workspaces/account-top-bar'

/**
 * /profile has the bar of /workspaces: the brand leads back to the
 * workspaces, with the theme, language and account buttons. Without it the
 * page was a dead end.
 */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AccountTopBar />
      <main className="flex-1 w-full">{children}</main>
    </div>
  )
}
