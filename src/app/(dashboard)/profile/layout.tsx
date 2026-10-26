import { AccountFrame } from '@/components/layout/account-frame'

/** /profile: the home page's header and frame (account-frame.tsx), like /workspaces. */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <AccountFrame>{children}</AccountFrame>
}
