import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Suspense } from 'react'
import { Loading } from '@/components/ui/loading'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeRoot } from '@/components/layout/theme-root'
import { THEME_COOKIE, parseThemePreference } from '@/lib/theme'
import { SessionScope } from '@/components/providers'

// "<page> · Digistay" for pages with a title of their own, "Digistay" for the
// rest: not Digistay's home page title. Workspace and property pages name the
// page and the hotel from the client (src/components/layout/document-title.tsx).
export const metadata: Metadata = {
  title: { default: 'Digistay', template: '%s · Digistay' },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value)

  // Workspace-scoped routes (under /workspace/[slug]) have their own
  // layout (WorkspaceShell) that handles its own sidebar.
  // Wrap in Suspense for useSearchParams support.
  // ToastProvider listens for toast.success()/error() from every dashboard
  // page; it sits inside ThemeRoot so toasts follow the dashboard's theme.
  // SessionScope: useSession (the profile page) without a fetch on load.
  return (
    <SessionScope session={session}>
      <ThemeRoot initial={theme}>
        <ToastProvider>
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </ToastProvider>
      </ThemeRoot>
    </SessionScope>
  )
}
