import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { PublicFrame } from '@/components/marketing/PublicFrame'
import { frame, inkButton, lineButton, softText } from '@/components/marketing/styles'
import { cn } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.meta')
  return { title: t('notFoundTitle'), robots: { index: false } }
}

/** Any address that matches no page (Claude Design "Digistay Loi", 404). */
export default async function NotFound() {
  const t = await getTranslations('auth.notFound')
  const links = [
    { href: '/#tinh-nang', label: t('features') },
    { href: '/pricing', label: t('pricing') },
    { href: '/login', label: t('login') },
  ]
  return (
    <PublicFrame>
      <MarketingHeader />
      <main className={cn(frame, 'flex justify-center pb-6 pt-12 lg:pt-24')}>
        <div className="w-full max-w-[640px]">
          <p className="font-mono text-[13px] font-medium text-brand">{t('code')}</p>
          <h1 className="mt-4 font-serif text-[36px] font-medium leading-[1.12] tracking-[-0.02em] lg:text-[52px]">{t('title')}</h1>
          <p className={cn('mt-4 text-[16px] leading-[1.7] lg:text-[17px]', softText)}>{t('lead')}</p>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/" className={cn(inkButton, 'h-[52px] px-11 text-[15px]')}>
              {t('home')}
            </Link>
            <Link href="/contact" className={cn(lineButton, 'h-[52px] px-6 text-[15px]')}>
              {t('report')}
            </Link>
          </div>
          <div className="mt-12 border-t border-line pt-6">
            <p className="text-label uppercase text-muted">{t('maybe')}</p>
            <ul className="mt-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex items-center justify-between border-b border-line/70 py-3.5 text-[15px] hover:underline">
                    {l.label}
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </PublicFrame>
  )
}
