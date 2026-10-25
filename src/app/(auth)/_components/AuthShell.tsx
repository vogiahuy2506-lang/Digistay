import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { LocaleToggle } from '@/components/marketing/LocaleToggle'
import { Logo } from '@/components/marketing/Logo'
import { publicTheme } from '@/components/marketing/PublicFrame'
import { ThemeToggle } from '@/components/marketing/ThemeToggle'
import { isLocale } from '@/i18n/locales'
import { cn } from '@/lib/utils'

/** public/marketing/hero-hoi-an-*.jpg: Sunrise Resort, Hội An, by Jamison Cameron (Unsplash License). */
const PHOTO_WIDTHS = [768, 1280, 1920] as const

/**
 * Sign-in, sign-up and password reset fill the screen in two halves from
 * lg: a resort photo with the logo and Digistay's line on the left (it
 * stays put if a form is taller than the screen), the form on the right under the
 * theme and language switches. Below lg only the form side shows.
 */
export async function AuthShell({ width = 440, children }: { width?: 440 | 600; children: React.ReactNode }) {
  const t = await getTranslations('marketing')
  const ta = await getTranslations('auth.common')
  const current = await getLocale()
  const locale = isLocale(current) ? current : 'vi'
  const theme = await publicTheme()
  const year = new Date().getFullYear()

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#1c1b19] lg:sticky lg:top-0 lg:block lg:h-screen">
        {/* eslint-disable-next-line @next/next/no-img-element -- srcSet of pre-cut widths (image optimization is off) */}
        <img
          src="/marketing/hero-hoi-an-1280.jpg"
          srcSet={PHOTO_WIDTHS.map((w) => `/marketing/hero-hoi-an-${w}.jpg ${w}w`).join(', ')}
          sizes="50vw"
          width={2400}
          height={1600}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[30%_60%]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/30" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link href="/" className="self-start rounded-ctl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Image src="/marketing/logo-dark.png" alt="Digistay" width={405} height={96} className="h-[30px] w-auto" />
          </Link>
          <div>
            <p className="max-w-[520px] text-balance font-serif text-[40px] font-medium leading-[1.12] tracking-[-0.02em] text-white xl:text-[46px]">
              {t('home.title')}
            </p>
            <p className="mt-8 text-[13px] text-white/60">{t('footer.copyright', { year })}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12 lg:py-5">
          <Link href="/" className="rounded-ctl lg:hidden">
            <Logo size="sm" />
          </Link>
          <Link href="/" className="hidden rounded-ctl text-[14px] text-muted transition-colors duration-160 hover:text-fg lg:block">
            ← {ta('home')}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle initial={theme} toDark={t('nav.toDark')} toLight={t('nav.toLight')} />
            <LocaleToggle locale={locale} label={t('nav.language')} />
          </div>
        </header>
        <main className="flex flex-1 justify-center px-5 pb-12 pt-6 sm:px-8 lg:items-center lg:px-12 lg:py-6">
          <div className={cn('w-full', width === 600 ? 'max-w-[600px]' : 'max-w-[440px]')}>{children}</div>
        </main>
        <footer className="flex flex-wrap justify-center gap-x-5 gap-y-1 px-5 pb-6 text-[13px] text-muted">
          <Link href="/terms" className="hover:text-fg">
            {t('footer.terms')}
          </Link>
          <Link href="/privacy" className="hover:text-fg">
            {t('footer.privacy')}
          </Link>
          <Link href="/contact" className="hover:text-fg">
            {t('nav.contact')}
          </Link>
        </footer>
      </div>
    </div>
  )
}
