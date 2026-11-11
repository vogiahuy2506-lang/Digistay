import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { DigisoLogo } from '@/components/marketing/DigisoLogo'
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
 * Digistay & DIGISO contact details.
 */
const CONTACT = {
  company: 'Công ty TNHH Giải pháp số DIGISO',
  taxId: '0316725362',
  email: 'info@digiso.vn',
  hotline: '0877 909 606',
  hours: '8:30 – 17:00 (Thứ 2 – Thứ 6)',
  address: 'Phòng I.101B, Tòa nhà A, Khu Công nghệ Phần mềm ĐHQG-HCM, Đường Võ Trường Toản, Khu phố 3, Phường Linh Xuân, TP. Hồ Chí Minh',
  digisoUrl: 'https://digiso.vn',
}

/** Contact page (Claude Design "Digistay Lien He"). Synchronized with DIGISO corporate profile. */
export default async function ContactPage() {
  const t = await getTranslations('marketing.contact')
  const info: { label: string; value: React.ReactNode }[] = [
    { label: t('companyLabel'), value: t('companyValue') },
    { label: t('taxIdLabel'), value: t('taxIdValue') },
    {
      label: t('hotlineLabel'),
      value: (
        <div>
          <a href={`tel:${CONTACT.hotline.replace(/[^\d+]/g, '')}`} className="font-semibold text-primary hover:underline">
            {CONTACT.hotline}
          </a>
          <span className="ml-2 text-xs text-muted">({t('hotlineHours')})</span>
        </div>
      ),
    },
    {
      label: t('emailLabel'),
      value: (
        <a href={`mailto:${CONTACT.email}`} className="text-primary hover:underline font-medium">
          {CONTACT.email}
        </a>
      ),
    },
    { label: t('addressLabel'), value: t('addressValue') },
  ]

  return (
    <>
      <MarketingHeader active="contact" />
      <main className={cn(frame, 'grid gap-10 pt-11 lg:grid-cols-[520px_minmax(0,1fr)] lg:gap-24 lg:pt-14')}>
        <div className="lg:pt-0">
          <h1 className="font-serif text-[40px] font-medium leading-[1.1] tracking-[-0.02em] lg:text-[52px]">{t('title')}</h1>
          <p className={cn('mt-4 text-[16px] leading-[1.7] lg:text-[17px]', softText)}>{t('lead')}</p>
          <dl className="mt-8 border-t border-line">
            {info.map((row) => (
              <div key={row.label} className="border-b border-line py-[16px]">
                <dt className="text-label uppercase text-muted text-[11.5px] font-semibold">{row.label}</dt>
                <dd className="mt-1 text-[15px] font-medium text-fg">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/* DIGISO Corporate Profile Card */}
          <div className="mt-8 rounded-box border border-line bg-panel p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <DigisoLogo size="sm" />
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                CHỦ QUẢN NỀN TẢNG
              </span>
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              {t('ecosystemTitle')}
            </h2>
            <p className="text-xs leading-relaxed text-muted">
              {t('ecosystemDesc')}
            </p>
            <a
              href={CONTACT.digisoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline pt-1"
            >
              {t('exploreEcosystem')}
            </a>
          </div>
        </div>
        <div className="rounded-box border border-line bg-panel p-5 sm:p-7 shadow-2xs">
          <ContactForm />
        </div>
      </main>
    </>
  )
}
