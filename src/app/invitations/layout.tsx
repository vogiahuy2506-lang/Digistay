import { PublicFrame } from '@/components/marketing/PublicFrame'

/** Invitation links, in the frame of Digistay's public pages (Claude Design "Digistay Loi Moi"). */
export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>
}
