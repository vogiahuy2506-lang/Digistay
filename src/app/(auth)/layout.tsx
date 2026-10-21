import { Suspense } from 'react'
import { PublicFrame } from '@/components/marketing/PublicFrame'

/**
 * Sign-in, sign-up and password reset, in the frame of Digistay's public
 * pages (Claude Design "Digistay Dang Nhap" / "Dang Ky" / "Quen Mat Khau").
 * Each page renders MarketingHeader itself, to mark where the visitor is.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicFrame>
      <Suspense fallback={null}>{children}</Suspense>
    </PublicFrame>
  )
}
