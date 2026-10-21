import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { AuthColumn } from '../_components/AuthColumn'
import { RegisterForm } from './RegisterForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.meta')
  return { title: t('registerTitle') }
}

export default function RegisterPage() {
  return (
    <>
      <MarketingHeader active="register" />
      <AuthColumn width={480}>
        <RegisterForm />
      </AuthColumn>
    </>
  )
}
