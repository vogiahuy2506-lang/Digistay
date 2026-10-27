import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { platformAdmin } from '@/lib/admin/guard'
import { AdminFrame } from '@/components/admin/admin-frame'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * The operator pages (/admin): checked here on the server before anything
 * renders, and again by every /api/admin route (src/lib/admin/guard.ts).
 * Anyone but an operator gets the site's 404.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id || !(await platformAdmin(session.user.id))) notFound()
  return <AdminFrame>{children}</AdminFrame>
}
