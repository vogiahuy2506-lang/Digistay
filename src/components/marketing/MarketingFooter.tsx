import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@/i18n/locales'
import { cn } from '@/lib/utils'
import { LocaleToggle } from './LocaleToggle'
import { Logo } from './Logo'
import { DigisoLogo } from './DigisoLogo'
import { frame } from './styles'

/** Footer of Digistay's public pages: enterprise compliance, product, policies, and legal links. */
export async function MarketingFooter() {
  const t = await getTranslations('marketing')
  const current = await getLocale()
  const locale = isLocale(current) ? current : 'vi'

  const columns = [
    {
      title: t('footer.product'),
      links: [
        { href: '/#tinh-nang', label: t('nav.features') },
        { href: '/pricing', label: t('nav.pricing') },
        { href: '/login', label: t('nav.login') },
        { href: '/register', label: t('nav.register') },
        { href: '/contact', label: t('nav.contact') },
      ],
    },
    {
      title: t('footer.policies'),
      links: [
        { href: '/pricing-policy', label: t('footer.pricingPolicy') },
        { href: '/payment-policy', label: t('footer.paymentPolicy') },
        { href: '/service-delivery-policy', label: t('footer.serviceDelivery') },
        { href: '/service-terms', label: t('footer.serviceTerms') },
        { href: '/refund-policy', label: t('footer.refundPolicy') },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { href: '/terms', label: t('footer.terms') },
        { href: '/privacy', label: t('footer.privacy') },
        { href: '/public-dpa', label: t('footer.publicDpa') },
        { href: '/rights-and-duties', label: t('footer.rightsAndDuties') },
        { href: '/complaint-policy', label: t('footer.complaintPolicy') },
        { href: '/support', label: t('footer.support') },
      ],
    },
  ]

  return (
    <footer className="mt-24 border-t border-line lg:mt-32">
      <div className={cn(frame, 'pb-8 pt-12 lg:pt-14')}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 text-[13.5px] sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1.2fr_1.2fr] lg:gap-10">
          <div className="sm:col-span-2 lg:col-span-1 space-y-3.5">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-muted/60">·</span>
              <a href="https://digiso.vn" target="_blank" rel="noopener noreferrer" title="DIGISO Digital Solutions">
                <DigisoLogo heightClass="h-6" />
              </a>
            </div>
            <p className="max-w-[340px] leading-[1.6] text-muted text-xs sm:text-[13px]">{t('footer.tagline')}</p>
            <div className="border-t border-line/70 pt-3 text-[12px] leading-relaxed text-muted space-y-1">
              <p className="font-semibold text-fg">{t('footer.company')}</p>
              <p>{t('footer.taxCode')}</p>
              <p>{t('footer.address')}</p>
              <p>{t('footer.hotline')}</p>
              <p>
                <a href="mailto:info@digiso.vn" className="text-primary hover:underline font-medium">
                  info@digiso.vn
                </a>
                <span className="mx-2 text-muted/60">·</span>
                <a href="https://digiso.vn" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                  digiso.vn ↗
                </a>
              </p>
            </div>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h2 className="mb-2.5 text-label uppercase text-muted font-bold text-[11px] tracking-wider">{c.title}</h2>
              <ul className="flex flex-col leading-[2.1] text-xs sm:text-[13px]">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-fg/90 hover:text-primary transition-colors hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5 text-[12px] text-muted">
          <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <LocaleToggle locale={locale} label={t('nav.language')} variant="text" />
        </div>
      </div>
    </footer>
  )
}
