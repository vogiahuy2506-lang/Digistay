import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@/i18n/locales'
import { cn } from '@/lib/utils'
import { LocaleToggle } from './LocaleToggle'
import { Logo } from './MarketingHeader'
import { frame } from './styles'

/** Footer of Digistay's own public pages: product, account and legal links, languages. */
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
      ],
    },
    {
      title: t('footer.account'),
      links: [
        { href: '/login', label: t('nav.login') },
        { href: '/register', label: t('nav.register') },
        { href: '/contact', label: t('nav.contact') },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { href: '/terms', label: t('footer.terms') },
        { href: '/privacy', label: t('footer.privacy') },
      ],
    },
  ]

  return (
    <footer className="mt-24 border-t border-line lg:mt-32">
      <div className={cn(frame, 'pb-8 pt-12 lg:pt-14')}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 text-[14px] sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-12">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Logo />
            <p className="mt-3 max-w-[300px] leading-[1.6] text-muted">{t('footer.tagline')}</p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h2 className="mb-2 text-label uppercase text-muted">{c.title}</h2>
              <ul className="flex flex-col leading-[2]">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-fg hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5 text-[12.5px] text-muted">
          <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <LocaleToggle locale={locale} label={t('nav.language')} variant="text" />
        </div>
      </div>
    </footer>
  )
}
