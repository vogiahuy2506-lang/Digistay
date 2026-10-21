import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import { MarketingHeader } from './MarketingHeader'
import { frame, lineButton, softText } from './styles'

/**
 * Terms of use and privacy policy are not written yet: these pages say so
 * instead of the footer and the sign-up form linking to a 404.
 */
export async function LegalPending({ title }: { title: 'terms' | 'privacy' }) {
  const t = await getTranslations('marketing')
  return (
    <>
      <MarketingHeader />
      <main className={cn(frame, 'pt-11 lg:pt-[88px]')}>
        <div className="max-w-[880px]">
        <h1 className="font-serif text-[40px] font-medium leading-[1.1] tracking-[-0.02em] lg:text-[56px]">{t(`footer.${title}`)}</h1>
        <p className={cn('mt-5 max-w-[640px] text-[16px] leading-[1.7]', softText)}>{t('legal.pending')}</p>
        <Link href="/contact" className={cn(lineButton, 'mt-8 h-12 px-6 text-[15px]')}>
          {t('legal.contact')}
        </Link>
        </div>
      </main>
    </>
  )
}
