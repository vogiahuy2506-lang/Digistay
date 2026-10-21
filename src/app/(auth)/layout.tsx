import { Suspense } from 'react'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

/**
 * Sign-in, sign-up and password reset, in the frame of Digistay's public
 * pages (Claude Design "Digistay Dang Nhap" / "Dang Ky" / "Quen Mat Khau").
 * Each page renders MarketingHeader itself, to mark where the visitor is.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page font-sans text-fg">
      <div className="flex-1">
        <Suspense fallback={null}>{children}</Suspense>
      </div>
      <MarketingFooter />
    </div>
  )
}
