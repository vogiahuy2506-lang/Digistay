import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { AuthColumn } from '@/app/(auth)/_components/AuthColumn'
import { InvitationView } from './InvitationView'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.meta')
  return { title: t('inviteTitle'), robots: { index: false } }
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <>
      <MarketingHeader />
      <AuthColumn width={560}>
        <InvitationView token={token} />
      </AuthColumn>
    </>
  )
}
