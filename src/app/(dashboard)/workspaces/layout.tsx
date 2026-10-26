import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AccountFrame } from '@/components/layout/account-frame'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workspaces')

  return {
    title: t('title'),
    description: t('lead'),
    robots: { index: false, follow: false },
  }
}

/** /workspaces: the home page's header and frame (account-frame.tsx), like /profile. */
export default function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  return <AccountFrame>{children}</AccountFrame>
}