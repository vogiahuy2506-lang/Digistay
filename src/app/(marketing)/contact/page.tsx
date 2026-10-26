import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame, softText } from '@/components/marketing/styles'
import { cn } from '@/lib/utils'
import { ContactForm } from './ContactForm'
import { appOrigin } from '@/lib/public-site/site-host'
import { digistayPageMetadata } from '@/lib/seo/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.meta')
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi'
  const title = t('contactTitle')
  const description = t('contactDescription')
  return { title, description, ...digistayPageMetadata({ origin: appOrigin(), locale, path: '/contact', title, description }) }
}

/**
 * Digistay's own contact details. Only what is decided shows: the hotline
 * and street address are not, and a row reading "Đang cập nhật" looked
 * unfinished (a made-up number could be a real person's). Fill them in
 * here once they exist.
 */
const CONTACT: { email: string; hotline: string | null; address: string | null } = {
  email: 'hello@digistay.vn',
  hotline: null,
  address: null,
}

/** Contact page (Claude Design "Digistay Lien He"). */
export default async function ContactPage() {
  const t = await getTranslations('marketing.contact')
  const info: { label: string; value: React.ReactNode }[] = [
    { label: t('emailLabel'), value: <a href={`mailto:${CONTACT.email}`} className="hover:underline">{CONTACT.email}</a> },
  ]
  if (CONTACT.hotline) {
    const hotline = CONTACT.hotline
    info.push({
      label: t('hotlineLabel'),
      value: (
        <a href={`tel:${hotline.replace(/[^\d+]/g, '')}`} className="hover:underline">
          {hotline}
        </a>
      ),
    })
  }
  if (CONTACT.address) info.push({ label: t('addressLabel'), value: CONTACT.address })

  return (
    <>
      <MarketingHeader active="contact" />
      <main className={cn(frame, 'grid gap-10 pt-11 lg:grid-cols-[520px_minmax(0,1fr)] lg:gap-24 lg:pt-14')}>
        <div className="lg:pt-0">
          <h1 className="font-serif text-[40px] font-medium leading-[1.1] tracking-[-0.02em] lg:text-[52px]">{t('title')}</h1>
          <p className={cn('mt-4 text-[16px] leading-[1.7] lg:text-[17px]', softText)}>{t('lead')}</p>
          <dl className="mt-8 border-t border-line">
            {info.map((row) => (
              <div key={row.label} className="border-b border-line py-[18px]">
                <dt className="text-label uppercase text-muted">{row.label}</dt>
                <dd className="mt-1.5 text-[16px] font-medium text-fg">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-box border border-line bg-panel p-5 sm:p-7">
          <ContactForm />
        </div>
      </main>
    </>
  )
}
