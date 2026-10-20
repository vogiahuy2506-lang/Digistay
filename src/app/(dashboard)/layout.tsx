import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Suspense } from 'react'
import { Loading } from '@/components/ui/loading'
import { ToastProvider } from '@/components/ui/toast'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Workspace-scoped routes (under /workspace/[slug]) have their own
  // layout (WorkspaceShell) that handles its own sidebar.
  // This layout just passes children through.
  // Wrap in Suspense for useSearchParams support.
  // ToastProvider listens for toast.success()/error() from every dashboard
  // page; it lives here, not in the root layout, so toasts follow the
  // dashboard's theme.
  return (
    <ToastProvider>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </ToastProvider>
  )
}
