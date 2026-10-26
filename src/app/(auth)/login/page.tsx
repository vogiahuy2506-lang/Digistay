import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { googleSignInConfigured } from '@/lib/auth/google'
import { AuthShell } from '../_components/AuthShell'
import { LoginForm } from './LoginForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.meta')
  return { title: t('loginTitle'), robots: { index: false } }
}

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm google={googleSignInConfigured()} />
    </AuthShell>
  )
}
