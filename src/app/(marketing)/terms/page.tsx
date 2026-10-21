import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalPending } from '@/components/marketing/LegalPending'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.meta')
  return { title: t('termsTitle'), robots: { index: false } }
}

export default function TermsPage() {
  return <LegalPending title="terms" />
}
