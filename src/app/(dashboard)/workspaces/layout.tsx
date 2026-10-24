import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workspaces')

  return {
    title: t('title'),
    description: t('lead'),
    robots: { index: false, follow: false },
  }
}

export default function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  return children
}