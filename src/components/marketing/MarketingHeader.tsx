import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@/i18n/locales'
import { auth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { LocaleToggle } from './LocaleToggle'
import { MarketingAccount, MarketingSignOutButton } from './MarketingAccount'
import { Logo } from './Logo'
import { MobileMenu } from './MobileMenu'
import { publicTheme } from './PublicFrame'
import { ThemeToggle } from './ThemeToggle'
import { frame, inkButton } from './styles'

export type MarketingPage = 'features' | 'pricing' | 'contact' | 'login' | 'register'

const LINKS = [
  { id: 'features', href: '/#tinh-nang' },
  { id: 'pricing', href: '/pricing' },
  { id: 'contact', href: '/contact' },
] as const

/**
 * The site header, one for every page with a top bar: Digistay's public
 * pages, the account pages (/workspaces, /profile) and the workspace level.
 * Logo, Tính năng / Bảng giá / Liên hệ, theme, VI | EN, Đăng nhập / Đăng ký
 * or the account menu (dashboard, profile, sign out). Below lg the links,
 * language, theme and sign-in / sign-out move into MobileMenu. `active`
 * marks the page the visitor is on. Inside a workspace, `context` (the
 * workspace switcher) takes the links' place next to the logo and `actions`
 * (the bell) sits before the theme button.
 */
export async function MarketingHeader({
  active,
  context,
  actions,
}: {
  active?: MarketingPage
  context?: React.ReactNode
  actions?: React.ReactNode
}) {
  const t = await getTranslations('marketing.nav')
  const current = await getLocale()
  const locale = isLocale(current) ? current : 'vi'
  const mark = (id: MarketingPage) => (active === id ? 'page' : undefined)
  // Signed in: the account instead of "Đăng nhập" / "Đăng ký" (Claude Design "Digistay Loi Moi").
  // A session that cannot be read (revoked, broken cookie) just shows the signed-out header.
  const email = await auth().then((session) => session?.user?.email ?? null, () => null)
  const theme = await publicTheme()

  return (
    <header className="relative border-b border-line/70">
      <div className={cn(frame, 'flex items-center justify-between gap-8 py-3 pr-3 lg:py-5 lg:pr-20')}>
        <div className={cn('flex min-w-0 items-center', context ? 'gap-3 lg:gap-5' : 'gap-14')}>
          <Link href="/" className="shrink-0 rounded-ctl">
            <span className="lg:hidden">
              {/* With the workspace switcher beside it, phones get the seal only. */}
              <Logo size="sm" markBelowSm={Boolean(context)} />
            </span>
            <span className="hidden lg:block">
              <Logo />
            </span>
          </Link>
          {context && (
            <>
              <span aria-hidden className="hidden h-5 w-px bg-line sm:block" />
              <div className="min-w-0">{context}</div>
            </>
          )}
          <nav aria-label={t('main')} className={cn('hidden gap-8 text-[14px]', !context && 'lg:flex')}>
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

        <div className="flex shrink-0 items-center gap-1 text-[14px] lg:gap-5">
          {actions}
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle initial={theme} toDark={t('toDark')} toLight={t('toLight')} />
            <LocaleToggle locale={locale} label={t('language')} />
          </div>
          {email ? (
            <MarketingAccount
              email={email}
              labels={{ menu: t('account', { email }), dashboard: t('toDashboard'), profile: t('profile'), signOut: t('signOut') }}
            />
          ) : (
            <>
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
            </>
          )}
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
            <div className="flex min-h-14 items-center justify-between border-b border-line/70">
              <span className="text-[14px] text-muted">{t('language')}</span>
              <LocaleToggle locale={locale} label={t('language')} size="lg" />
            </div>
            <div className="flex min-h-14 items-center justify-between">
              <span className="text-[14px] text-muted">{t('theme')}</span>
              <ThemeToggle initial={theme} toDark={t('toDark')} toLight={t('toLight')} className="h-11 w-11 border border-line" />
            </div>
            {email ? (
              <MarketingSignOutButton label={t('signOut')} />
            ) : (
              <Link
                href="/login"
                className="mt-1 flex h-12 items-center justify-center rounded-ctl border border-ink text-[15px] font-medium text-fg"
              >
                {t('login')}
              </Link>
            )}
          </MobileMenu>
        </div>
      </div>
    </header>
  )
}
