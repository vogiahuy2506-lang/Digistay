import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { AuthColumn } from '../_components/AuthColumn'
import { ForgotForm } from './ForgotForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.meta')
  return { title: t('forgotTitle'), robots: { index: false } }
}

export default function ForgotPasswordPage() {
  return (
    <>
      <MarketingHeader />
      <AuthColumn>
        <ForgotForm />
      </AuthColumn>
    </>
  )
}
