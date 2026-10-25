import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { BrowserFrame } from '@/components/marketing/BrowserFrame'
import { Faq } from '@/components/marketing/Faq'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame, inkButton, lineButton, sectionTitle, softText } from '@/components/marketing/styles'
import { formatVnd } from '@/lib/bookings/display'
import { PLANS } from '@/lib/marketing/plans'
import { cn } from '@/lib/utils'
import { appOrigin } from '@/lib/public-site/site-host'
import { digistayPageMetadata } from '@/lib/seo/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.meta')
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi'
  const title = t('homeTitle')
  const description = t('homeDescription')
  return { title, description, ...digistayPageMetadata({ origin: appOrigin(), locale, path: '/', title, description }) }
}

/**
 * The hero photo: Sunrise Resort, Hội An, by Jamison Cameron (Unsplash
 * License, unsplash.com/photos/Rp4HUchyUQY). Image optimization is off
 * (next.config.ts), so the widths are cut ahead of time.
 */
const HERO_WIDTHS = [768, 1280, 1920, 2400] as const

/** The screenshots in public/marketing are the real app (demo data), 1440 px wide. */
const FEATURES = [
  { id: 'site', points: 3, url: 'khach-san-demo.digistay.vn', src: '/marketing/site-home.jpg', height: 2016 },
  { id: 'booking', points: 3, url: 'khach-san-demo.digistay.vn/rooms/standard', src: '/marketing/site-room.jpg', height: 880 },
  { id: 'admin', points: 4, url: 'digistay.vn/workspace/…/bookings', src: '/marketing/admin-bookings.jpg', darkSrc: '/marketing/admin-bookings-dark.jpg', height: 1040 },
  { id: 'money', points: 3, url: 'digistay.vn/workspace/…/payments', src: '/marketing/admin-payments.jpg', height: 1040 },
] as const

const FAQ = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const
const STEPS = ['s1', 's2', 's3'] as const

/** Digistay's home page (Claude Design "Digistay Gioi Thieu"). */
export default async function HomePage() {
  const t = await getTranslations('marketing.home')
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi'
  const [starter, growth, business] = PLANS

  return (
    <>
      <MarketingHeader />
      <main>
        {/* Hero: the headline over a hotel photo that fills the first screen; the app screenshots rise over its lower edge */}
        <section className="relative isolate overflow-hidden bg-[#1c1b19]">
          {/* eslint-disable-next-line @next/next/no-img-element -- srcSet of pre-cut widths (image optimization is off) */}
          <img
            src="/marketing/hero-hoi-an-1280.jpg"
            srcSet={HERO_WIDTHS.map((w) => `/marketing/hero-hoi-an-${w}.jpg ${w}w`).join(', ')}
            sizes="100vw"
            width={2400}
            height={1600}
            alt={t('photoAlt')}
            fetchPriority="high"
            className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_70%]"
          />
          {/* Darker toward the text (left on wide screens, bottom on phones) so white type stays readable */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/40 to-black/10 lg:bg-gradient-to-r lg:from-black/70 lg:via-black/35 lg:to-transparent" />
          <div className={cn(frame, 'flex min-h-[calc(100svh-69px)] flex-col justify-end pb-32 pt-24 sm:pb-40 lg:min-h-[calc(100svh-81px)] lg:pb-[200px] lg:pt-28')}>
            <p className="text-[11px] font-medium uppercase leading-[1.6] tracking-[0.16em] text-white/80 lg:text-[12px]">{t('eyebrow')}</p>
            <h1 className="mt-3.5 max-w-[820px] text-balance font-serif text-[38px] font-medium leading-[1.12] tracking-[-0.02em] text-white lg:mt-5 lg:text-[60px] lg:leading-[1.08] lg:tracking-[-0.025em]">
              {t('title')}
            </h1>
            <p className="mt-4 max-w-[600px] text-pretty text-[16px] leading-[1.65] text-white/85 lg:mt-5 lg:text-[18px]">{t('lead')}</p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row lg:mt-8 lg:gap-3">
              <Link href="/register" className={cn(inkButton, 'h-[52px] bg-white px-7 text-[15px] text-[#1c1b19] hover:bg-white/90')}>
                {t('register')}
              </Link>
              <Link href="/pricing" className={cn(lineButton, 'h-[52px] border-white/80 px-[26px] text-[15px] text-white hover:bg-white/10')}>
                {t('seePricing')}
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className={cn(frame, 'relative -mt-24 sm:-mt-32 lg:-mt-[140px]')}>
            <div className="relative mx-auto aspect-[350/420] max-w-[560px] lg:hidden">
              <BrowserFrame
                url="digistay.vn"
                src="/marketing/admin-bookings.jpg"
                darkSrc="/marketing/admin-bookings-dark.jpg"
                alt={t('altAdmin')}
                width={1440}
                height={1040}
                aspect="330/238"
                className="absolute left-0 top-0 w-[94.3%] shadow-[0_24px_48px_-24px_rgba(28,27,25,.55)]"
              />
              <div className="absolute right-0 top-[28.6%] w-[48.6%] overflow-hidden rounded-[14px] border border-line bg-panel shadow-[0_24px_48px_-24px_rgba(28,27,25,.5)]">
                <div className="aspect-[170/290] overflow-hidden">
                  <Image src="/marketing/site-home-mobile.jpg" alt={t('altSite')} width={390} height={666} className="block h-auto w-full" />
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <BrowserFrame
                url="digistay.vn/workspace/…/bookings"
                src="/marketing/admin-bookings.jpg"
                darkSrc="/marketing/admin-bookings-dark.jpg"
                alt={t('altAdmin')}
                width={1440}
                height={1040}
                aspect="1040/640"
                className="w-[81.25%] shadow-[0_40px_80px_-40px_rgba(28,27,25,.55)]"
              />
              <BrowserFrame
                url="khach-san-demo.digistay.vn"
                src="/marketing/site-home.jpg"
                alt={t('altSite')}
                width={1440}
                height={2016}
                aspect="400/560"
                className="absolute right-0 top-[120px] w-[31.25%] shadow-[0_40px_80px_-40px_rgba(28,27,25,.5)]"
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="tinh-nang" className={cn(frame, 'scroll-mt-6 pt-[72px] lg:pt-32')}>
          <h2 className={cn(sectionTitle, 'max-w-[760px] text-balance')}>{t('features.title')}</h2>

          <div className="mt-9 flex flex-col gap-14 lg:mt-20 lg:gap-[120px]">
            {FEATURES.map((f, i) => (
              <article
                key={f.id}
                className={cn(
                  'grid items-center gap-5 lg:gap-[72px]',
                  i % 2 ? 'lg:grid-cols-[minmax(0,1.33fr)_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.33fr)]',
                )}
              >
                <div className={cn('order-2 min-w-0', i % 2 ? 'lg:order-2' : 'lg:order-1')}>
                  <p className="font-mono text-[12px] font-medium text-brand">
                    0{i + 1} / 0{FEATURES.length}
                  </p>
                  <h3 className="mt-2.5 text-balance font-serif text-[28px] font-medium leading-[1.2] tracking-[-0.015em] lg:mt-3.5 lg:text-[36px]">
                    {t(`features.${f.id}.title`)}
                  </h3>
                  <p className={cn('mt-3 text-pretty text-[15px] leading-[1.65] lg:mt-4 lg:text-[16px] lg:leading-[1.7]', softText)}>
                    {t(`features.${f.id}.desc`)}
                  </p>
                  <ul className="mt-5 border-t border-line lg:mt-6">
                    {Array.from({ length: f.points }, (_, p) => (
                      <li
                        key={p}
                        className="grid grid-cols-[16px_minmax(0,1fr)] gap-3 border-b border-line/70 py-3 text-[14.5px] leading-[1.55] lg:py-[13px]"
                      >
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-[1px] bg-ink" />
                        {/* p1..p5: the feature's points in messages */}
                        <span>{t(`features.${f.id}.p${p + 1}` as `features.admin.p1`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <BrowserFrame
                  url={f.url}
                  src={f.src}
                  darkSrc={'darkSrc' in f ? f.darkSrc : undefined}
                  alt={t(`features.${f.id}.alt`)}
                  width={1440}
                  height={f.height}
                  aspect="720/440"
                  className={cn(
                    'order-1 shadow-[0_32px_64px_-44px_rgba(28,27,25,.4)]',
                    i % 2 ? 'lg:order-1' : 'lg:order-2',
                  )}
                />
              </article>
            ))}
          </div>
        </section>

        {/* Three steps */}
        <section className={cn(frame, 'pt-24 lg:pt-36')}>
          <h2 className={sectionTitle}>{t('steps.title')}</h2>
          <ol className="mt-9 grid border-t border-ink lg:mt-14 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s} className="border-b border-line/70 py-6 lg:border-b-0 lg:pb-0 lg:pr-10 lg:pt-7">
                <p className="font-mono text-[13px] font-medium text-muted">0{i + 1}</p>
                <h3 className="mt-3 font-serif text-[24px] font-medium leading-[1.25] lg:mt-[18px] lg:text-[28px]">{t(`steps.${s}.title`)}</h3>
                <p className={cn('mt-2.5 max-w-[340px] text-[15px] leading-[1.7] lg:mt-3', softText)}>{t(`steps.${s}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing in one line; the plans are compared on /pricing */}
        <section className={cn(frame, 'pt-24 lg:pt-36')}>
          <div className="flex flex-col gap-6 rounded-box border border-line bg-panel px-6 py-7 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-12 lg:py-10">
            <div>
              <h2 className="text-label font-medium uppercase text-muted">{t('pricing.title')}</h2>
              <p className="mt-2.5 font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.015em] tabular-nums lg:text-[40px]">
                {t('pricing.from', { price: formatVnd(starter.price, locale) })}
              </p>
              <p className={cn('mt-2 text-[15px] leading-[1.6]', softText)}>{t('pricing.summary')}</p>
            </div>
            <Link href="/pricing" className={cn(lineButton, 'h-[52px] shrink-0 px-[26px] text-[15px] hover:bg-ink hover:text-on-ink')}>
              {t('pricing.compare')} →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className={cn(frame, 'grid gap-8 pt-24 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:gap-24 lg:pt-36')}>
          <h2 className={sectionTitle}>{t('faq.title')}</h2>
          <Faq
            items={FAQ.map((q) => ({
              q: t(`faq.${q}.q`),
              a:
                q === 'q4'
                  ? t('faq.q4.a', { starter: starter.properties, growth: growth.properties, business: business.properties })
                  : t(`faq.${q}.a` as 'faq.q1.a'),
            }))}
          />
        </section>

        {/* Call to action */}
        <section className={cn(frame, 'pt-24 lg:pt-36')}>
          <div className="grid gap-8 rounded-box bg-plain-soft px-6 py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12 lg:px-16 lg:py-[72px]">
            <div>
              <h2 className="max-w-[720px] text-balance font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[44px]">
                {t('cta.title')}
              </h2>
              <p className={cn('mt-4 max-w-[600px] text-[16px] leading-[1.7]', softText)}>{t('cta.lead')}</p>
            </div>
            <div className="flex flex-col gap-2.5 lg:min-w-[220px]">
              <Link href="/register" className={cn(inkButton, 'h-[52px] px-7 text-[15px]')}>
                {t('cta.register')}
              </Link>
              <Link href="/contact" className={cn(lineButton, 'h-[52px] px-6 text-[15px]')}>
                {t('cta.contact')}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
