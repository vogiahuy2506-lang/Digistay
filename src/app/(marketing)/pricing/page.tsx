import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Faq } from '@/components/marketing/Faq'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame, inkButton, lineButton, sectionTitle, softText } from '@/components/marketing/styles'
import { formatVnd } from '@/lib/bookings/display'
import { ADDON_IDS, ADDON_PRICES, COMPARE, PLANS, YEARLY_MONTHS, yearlyPrice, type Cell, type Plan } from '@/lib/marketing/plans'
import { cn } from '@/lib/utils'
import { ComparePicker, CompareCell, type CompareGroupView } from './ComparePicker'
import { PlanCards } from './PlanCards'
import { appOrigin } from '@/lib/public-site/site-host'
import { digistayPageMetadata } from '@/lib/seo/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.meta')
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi'
  const title = t('pricingTitle')
  const description = t('pricingDescription')
  return { title, description, ...digistayPageMetadata({ origin: appOrigin(), locale, path: '/pricing', title, description }) }
}

const FAQ = ['q1', 'q2', 'q3', 'q4', 'q5'] as const

/** Plans, add-ons and the feature comparison (Claude Design "Digistay Bang Gia"). Sample content: src/lib/marketing/plans.ts. */
export default async function PricingPage() {
  const t = await getTranslations('marketing.pricing')
  const tp = await getTranslations('marketing.plans')
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi'
  const n = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN')

  const limit = (p: Plan, k: 'properties' | 'rooms' | 'staff' | 'invoices') =>
    k === 'invoices' && p.invoices === 0 ? tp('none') : n.format(p[k])
  const cell = (p: Plan, c: Cell): string | boolean =>
    c === 'invoices'
      ? t('compare.invoicesCell', { count: n.format(p.invoices) })
      : c === 'properties'
        ? t('compare.propertiesCell', { count: p.properties })
        : c

  const planNames = PLANS.map((p) => tp(`${p.id}.name`))
  const groups: CompareGroupView[] = COMPARE.map((g) => ({
    title: t(`compare.groups.${g.group}`),
    rows: g.rows.map((r) => ({ label: t(`compare.rows.${r.id}`), cells: PLANS.map((p) => cell(p, r.cells[p.id])) })),
  }))

  return (
    <>
      <MarketingHeader active="pricing" />
      <main>
        {/* Title, monthly / yearly switch and the plans */}
        <section className={cn(frame, 'pt-10 lg:pt-14')}>
          <PlanCards
            title={t('title')}
            plans={PLANS.map((p) => ({
              id: p.id,
              name: tp(`${p.id}.name`),
              fit: tp(`${p.id}.fit`),
              monthly: formatVnd(p.price, locale),
              yearly: formatVnd(yearlyPrice(p), locale),
              saving: t('billing.saving', { amount: formatVnd(p.price * 12 - yearlyPrice(p), locale) }),
              limits: (['properties', 'rooms', 'staff', 'invoices'] as const).map((k) => ({
                label: tp(k),
                value: limit(p, k),
                muted: k === 'invoices' && p.invoices === 0,
              })),
            }))}
            labels={{
              billing: t('billing.label'),
              monthly: t('billing.monthly'),
              yearly: t('billing.yearly'),
              badge: t('billing.badge', { months: 12 - YEARLY_MONTHS }),
              perMonth: tp('perMonth'),
              perYear: tp('perYear'),
              fit: t('fit'),
              choose: t('choose'),
            }}
          />
        </section>
        <p className={cn(frame, 'mt-4 text-[13px] text-muted')}>{tp('vat')}</p>

        {/* Add-ons */}
        <section className={cn(frame, 'pt-24 lg:pt-28')}>
          <h2 data-reveal className={sectionTitle}>
            {t('addons.title')}
          </h2>
          <ul data-reveal className="mt-6 border-t border-line lg:mt-10 lg:rounded-box lg:border lg:bg-panel">
            {ADDON_IDS.map((a) => (
              <li
                key={a}
                className="grid gap-1 border-b border-line/70 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_260px] lg:items-center lg:gap-8 lg:px-7 lg:py-[22px]"
              >
                <span className="flex items-baseline justify-between gap-4 text-[15px] font-medium lg:text-[16px]">
                  {t(`addons.${a}.name`)}
                  <span className="whitespace-nowrap text-[14px] font-semibold tabular-nums lg:hidden">{formatVnd(ADDON_PRICES[a], locale)}</span>
                </span>
                <span className="text-[13.5px] leading-[1.55] text-muted lg:text-[14px]">
                  {t(`addons.${a}.desc`)}
                  <span className="lg:hidden"> {t(`addons.${a}.unit`)}</span>
                </span>
                <span className="hidden whitespace-nowrap text-right lg:block">
                  <span className="text-[15px] font-semibold tabular-nums">{formatVnd(ADDON_PRICES[a], locale)}</span>{' '}
                  <span className="text-[13.5px] text-muted">{t(`addons.${a}.unit`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Comparison */}
        <section className={cn(frame, 'pt-24 lg:pt-28')}>
          <h2 data-reveal className={sectionTitle}>
            {t('compare.title')}
          </h2>
          <div data-reveal className="mt-6 lg:hidden">
            <ComparePicker plans={planNames} groups={groups} label={t('compare.choosePlan')} yes={t('compare.yes')} no={t('compare.no')} />
          </div>
          <div data-reveal className="mt-10 hidden overflow-hidden rounded-box border border-line bg-panel lg:block">
            <table className="w-full border-collapse text-[14.5px]">
              <thead>
                <tr className="border-b border-ink">
                  <th scope="col" className="w-[40%] px-7 py-[18px] text-left text-[13px] font-normal text-muted">
                    {t('compare.feature')}
                  </th>
                  {planNames.map((name) => (
                    <th key={name} scope="col" className="px-4 py-[18px] text-center text-[14px] font-semibold">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.title}>
                  <tr className="bg-page">
                    <th colSpan={1 + PLANS.length} scope="colgroup" className="border-b border-line/70 px-7 pb-3 pt-5 text-left text-label font-semibold uppercase text-muted">
                      {g.title}
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.label} className="border-b border-line/70 last:border-b-0">
                      <th scope="row" className="px-7 py-[15px] text-left font-normal">
                        {r.label}
                      </th>
                      {r.cells.map((c, i) => (
                        <td key={i} className="px-4 py-[15px] text-center">
                          <CompareCell value={c} yes={t('compare.yes')} no={t('compare.no')} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>

        {/* Billing questions */}
        <section className={cn(frame, 'grid gap-8 pt-24 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:gap-24 lg:pt-28')}>
          <h2 data-reveal className={sectionTitle}>
            {t('faq.title')}
          </h2>
          <Faq reveal items={FAQ.map((q) => ({ q: t(`faq.${q}.q`), a: t(`faq.${q}.a`) }))} />
        </section>

        <section className={cn(frame, 'pt-24 lg:pt-28')}>
          <div data-reveal="rise" className="grid gap-6 rounded-box bg-plain-soft px-6 py-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12 lg:px-14 lg:py-14">
            <div>
              <h2 className="font-serif text-[28px] font-medium leading-[1.2] tracking-[-0.015em] lg:text-[36px]">{t('cta.title')}</h2>
              <p className={cn('mt-3 text-[15.5px] leading-[1.7]', softText)}>{t('cta.lead')}</p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link href="/contact" className={cn(lineButton, 'h-[52px] px-6 text-[15px]')}>
                {t('cta.contact')}
              </Link>
              <Link href="/register" className={cn(inkButton, 'h-[52px] px-7 text-[15px]')}>
                {t('cta.register')}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
