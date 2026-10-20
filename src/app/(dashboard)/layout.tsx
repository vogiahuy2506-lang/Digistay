import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Suspense } from 'react'
import { Loading } from '@/components/ui/loading'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeRoot } from '@/components/layout/theme-root'
import { THEME_COOKIE, parseThemePreference } from '@/lib/theme'

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
  return (
    <ThemeRoot initial={theme}>
      <ToastProvider>
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </ToastProvider>
    </ThemeRoot>
  )
}
