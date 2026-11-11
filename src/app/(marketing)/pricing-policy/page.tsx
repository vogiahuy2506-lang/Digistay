import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { LegalDocViewer } from '@/components/marketing/LegalDocViewer'
import { LEGAL_DOCS } from '@/lib/marketing/legal-docs'

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi'
  return { title: `${LEGAL_DOCS['pricing-policy'][locale].title} · Digistay` }
}

export default function PricingPolicyPage() {
  return <LegalDocViewer slug="pricing-policy" />
}
