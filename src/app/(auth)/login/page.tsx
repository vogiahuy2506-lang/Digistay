import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { AuthColumn } from '../_components/AuthColumn'
import { LoginForm } from './LoginForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.meta')
  return { title: t('loginTitle'), robots: { index: false } }
}

export default function LoginPage() {
  return (
    <>
      <MarketingHeader active="login" />
      <AuthColumn>
        <LoginForm />
      </AuthColumn>
    </>
  )
}
