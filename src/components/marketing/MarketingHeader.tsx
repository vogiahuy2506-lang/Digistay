import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@/i18n/locales'
import { cn } from '@/lib/utils'
import { LocaleToggle } from './LocaleToggle'
import { Logo } from './Logo'
import { MobileMenu } from './MobileMenu'
import { frame, inkButton } from './styles'

export type MarketingPage = 'features' | 'pricing' | 'contact' | 'login' | 'register'

const LINKS = [
  { id: 'features', href: '/#tinh-nang' },
  { id: 'pricing', href: '/pricing' },
  { id: 'contact', href: '/contact' },
] as const

/**
 * Header of Digistay's own public pages: logo, Tính năng / Bảng giá / Liên
 * hệ, VI | EN, Đăng nhập, Đăng ký. Below lg the links, language and sign-in
 * move into MobileMenu. `active` marks the page the visitor is on.
 */
export async function MarketingHeader({ active }: { active?: MarketingPage }) {
  const t = await getTranslations('marketing.nav')
  const current = await getLocale()
  const locale = isLocale(current) ? current : 'vi'
  const mark = (id: MarketingPage) => (active === id ? 'page' : undefined)

  return (
    <header className="relative border-b border-line/70">
      <div className={cn(frame, 'flex items-center justify-between gap-8 py-3 pr-3 lg:py-5 lg:pr-20')}>
        <div className="flex items-center gap-14">
          <Link href="/" className="rounded-ctl">
            <span className="lg:hidden">
              <Logo size="sm" />
            </span>
            <span className="hidden lg:block">
              <Logo />
            </span>
          </Link>
          <nav aria-label={t('main')} className="hidden gap-8 text-[14px] lg:flex">
            {LINKS.map((l) => (
              <Link
                key={l.id}
                href={l.href}
                aria-current={mark(l.id)}
                className={cn(
                  'border-b py-1.5 text-fg transition-colors duration-160',
                  active === l.id ? 'border-fg font-medium' : 'border-transparent hover:border-line',
                )}
              >
                {t(l.id)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1 text-[14px] lg:gap-5">
          <div className="hidden lg:block">
            <LocaleToggle locale={locale} label={t('language')} />
          </div>
          <Link
            href="/login"
            aria-current={mark('login')}
            className={cn(
              'hidden border-b px-1 py-2 font-medium text-fg lg:block',
              active === 'login' ? 'border-fg' : 'border-transparent hover:border-line',
            )}
          >
            {t('login')}
          </Link>
          <Link href="/register" aria-current={mark('register')} className={cn(inkButton, 'h-11 px-4 lg:h-10 lg:px-[18px]')}>
            {t('register')}
          </Link>
          <MobileMenu openLabel={t('openMenu')} closeLabel={t('closeMenu')}>
            <nav aria-label={t('main')}>
              {LINKS.map((l) => (
                <Link
                  key={l.id}
                  href={l.href}
                  aria-current={mark(l.id)}
                  className="flex min-h-[52px] items-center border-b border-line/70 text-[16px] text-fg"
                >
                  {t(l.id)}
                </Link>
              ))}
            </nav>
            <div className="flex min-h-14 items-center justify-between">
              <span className="text-[14px] text-muted">{t('language')}</span>
              <LocaleToggle locale={locale} label={t('language')} size="lg" />
            </div>
            <Link
              href="/login"
              className="mt-1 flex h-12 items-center justify-center rounded-ctl border border-ink text-[15px] font-medium text-fg"
            >
              {t('login')}
            </Link>
          </MobileMenu>
        </div>
      </div>
    </header>
  )
}
