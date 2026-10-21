import { MarketingFooter } from '@/components/marketing/MarketingFooter'

/** Invitation links, in the frame of Digistay's public pages (Claude Design "Digistay Loi Moi"). */
export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page font-sans text-fg">
      <div className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  )
}
