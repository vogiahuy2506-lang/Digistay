import { Suspense } from 'react'
import { Loading } from '@/components/ui/loading'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </div>
  )
}
