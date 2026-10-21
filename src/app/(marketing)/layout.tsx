import { PublicFrame } from '@/components/marketing/PublicFrame'

/**
 * Digistay's own public pages (home, pricing, contact, legal), redesigned
 * from Claude Design "Digistay Gioi Thieu" / "Digistay Bang Gia", light or
 * dark (PublicFrame). Each page renders MarketingHeader itself, to mark
 * where the visitor is.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>
}
