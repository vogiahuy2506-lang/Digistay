import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PublicFrame } from '@/components/marketing/PublicFrame'
import { SessionScope } from '@/components/providers'

/**
 * Invitation links, in the frame of Digistay's public pages (Claude Design "Digistay Loi Moi").
 * The view checks who is signed in (useSession).
 */
export default async function InvitationLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <SessionScope session={session}>
      <PublicFrame>{children}</PublicFrame>
    </SessionScope>
  )
}
