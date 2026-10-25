import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AuthShell } from '../_components/AuthShell'
import { RegisterForm } from './RegisterForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.meta')
  return { title: t('registerTitle') }
}

export default function RegisterPage() {
  return (
    <AuthShell width={480}>
      <RegisterForm />
    </AuthShell>
  )
}
