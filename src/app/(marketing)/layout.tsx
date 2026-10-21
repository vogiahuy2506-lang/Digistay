import { MarketingFooter } from '@/components/marketing/MarketingFooter'

/**
 * Digistay's own public pages (home, pricing, contact, legal), redesigned
 * from Claude Design "Digistay Gioi Thieu" / "Digistay Bang Gia": light only.
 * Each page renders MarketingHeader itself, to mark where the visitor is.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page font-sans text-fg">
      <div className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  )
}
