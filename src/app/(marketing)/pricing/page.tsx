import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Faq } from '@/components/marketing/Faq'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame, inkButton, lineButton, sectionTitle, softText } from '@/components/marketing/styles'
import { formatVnd } from '@/lib/bookings/display'
import { ADDON_IDS, ADDON_PRICES, YEARLY_MONTHS } from '@/lib/marketing/plans'
import { getAllPlatformPlans, type FullPlatformPlan } from '@/lib/plans/dynamic-plans'
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

/**
 * Plans, add-ons and the 8-group feature comparison table.
 * Synchronized with Super Admin's Platform Plans management (/admin/plans).
 */
export default async function PricingPage() {
  const t = await getTranslations('marketing.pricing')
  const tp = await getTranslations('marketing.plans')
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi'
  const isEn = locale === 'en'
  const n = new Intl.NumberFormat(isEn ? 'en-US' : 'vi-VN')

  // Load active public plans from database (or fallback presets)
  const fullPlans: FullPlatformPlan[] = await getAllPlatformPlans({ includePrivate: false, includeInactive: false })
  const planNames = fullPlans.map((p) => p.name)

  // 8 Dynamic Feature Groups mirroring Super Admin's Platform Plans management
  const groups: CompareGroupView[] = [
    {
      title: isEn ? '1. Scale & Core Capacity' : '1. Quy mô & Cơ sở vật chất',
      rows: [
        {
          label: isEn ? 'Properties managed' : 'Số cơ sở lưu trú tối đa',
          cells: fullPlans.map((p) => (p.properties === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${p.properties} ${isEn ? 'properties' : 'cơ sở'}`)),
        },
        {
          label: isEn ? 'Total rooms quota' : 'Số phòng tối đa toàn hệ thống',
          cells: fullPlans.map((p) => (p.rooms === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${n.format(p.rooms)} ${isEn ? 'rooms' : 'phòng'}`)),
        },
        {
          label: isEn ? 'Room types per property' : 'Số loại phòng mỗi cơ sở',
          cells: fullPlans.map((p) => (p.maxRoomTypes === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${p.maxRoomTypes} ${isEn ? 'types' : 'loại'}`)),
        },
        {
          label: isEn ? 'Staff & Manager accounts' : 'Tài khoản nhân viên quản lý',
          cells: fullPlans.map((p) => (p.staff === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${p.staff} ${isEn ? 'accounts' : 'tài khoản'}`)),
        },
        {
          label: isEn ? 'Monthly booking volume' : 'Lượt đặt phòng tối đa / tháng',
          cells: fullPlans.map((p) => (p.maxMonthlyBookings === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${n.format(p.maxMonthlyBookings)} ${isEn ? 'bookings' : 'đơn/tháng'}`)),
        },
        {
          label: isEn ? 'Platform transaction fee' : 'Phí hoa hồng giao dịch nền tảng',
          cells: fullPlans.map((p) => `${p.transactionFeePercent}% (${isEn ? 'Commission-free' : 'Không chiết khấu'})`),
        },
      ],
    },
    {
      title: isEn ? '2. Direct Booking Website & Branding' : '2. Website Khách sạn & Nhận diện thương hiệu',
      rows: [
        {
          label: isEn ? 'Direct Booking Website Builder' : 'Trình dựng website đặt phòng trực tiếp',
          cells: fullPlans.map(() => true),
        },
        {
          label: isEn ? 'Free Subdomain (*.digistay.vn)' : 'Tên miền con miễn phí (*.digistay.vn)',
          cells: fullPlans.map(() => true),
        },
        {
          label: isEn ? 'Custom Domain support' : 'Tên miền riêng độc quyền (VD: khachsanabc.vn)',
          cells: fullPlans.map((p) => p.hasCustomDomain),
        },
        {
          label: isEn ? 'Remove Digistay branding' : 'Gỡ nhãn watermark "Powered by Digistay"',
          cells: fullPlans.map((p) => p.allowRemoveDigistayBranding),
        },
        {
          label: isEn ? 'Multi-language (Vietnamese & English)' : 'Website song ngữ (Tiếng Việt & Tiếng Anh)',
          cells: fullPlans.map((p) => p.hasMultiLanguage),
        },
        {
          label: isEn ? 'Custom content & blog pages' : 'Số bài viết & trang nội dung tùy chỉnh',
          cells: fullPlans.map((p) => (p.maxCustomPages === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${p.maxCustomPages} ${isEn ? 'pages' : 'trang'}`)),
        },
        {
          label: isEn ? 'Marketing Tracking Pixel (FB Pixel, GA4, GTM)' : 'Chèn mã theo dõi quảng cáo (Facebook Pixel, GA4)',
          cells: fullPlans.map((p) => p.allowCustomTrackingCode),
        },
      ],
    },
    {
      title: isEn ? '3. Artificial Intelligence (AI & Automation)' : '3. Trí tuệ Nhân tạo & Tự động hoá (AI)',
      rows: [
        {
          label: isEn ? 'AI Marketing content generator (Gemini)' : 'Tạo bài viết Marketing AI (Google Gemini)',
          cells: fullPlans.map((p) => `${p.monthlyAiContentQuota} ${isEn ? 'articles/mo' : 'bài/tháng'}`),
        },
        {
          label: isEn ? '24/7 AI Chatbot Assistant' : 'Trợ lý Chatbot AI tư vấn đặt phòng 24/7',
          cells: fullPlans.map((p) => p.hasChatbotAi),
        },
        {
          label: isEn ? 'AI Chatbot messages quota' : 'Số tin nhắn Chatbot AI tư vấn / tháng',
          cells: fullPlans.map((p) => (p.monthlyChatbotMessages === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${n.format(p.monthlyChatbotMessages)} ${isEn ? 'messages' : 'tin/tháng'}`)),
        },
        {
          label: isEn ? 'AI Smart Dynamic Pricing' : 'Định giá phòng thông minh AI theo nhu cầu',
          cells: fullPlans.map((p) => p.hasAiSmartPricing),
        },
      ],
    },
    {
      title: isEn ? '4. Channel Management & OTA Calendar Sync' : '4. Kênh Bán phòng & Đồng bộ lịch OTA',
      rows: [
        {
          label: isEn ? 'Two-way iCal Sync (.ics) for Airbnb, Agoda, Booking' : 'Đồng bộ lịch iCal (.ics) 2 chiều với Airbnb, Agoda, Booking.com',
          cells: fullPlans.map((p) => p.hasOtaIcalSync),
        },
        {
          label: isEn ? 'Connected iCal feeds limit' : 'Số luồng kết nối lịch iCal',
          cells: fullPlans.map((p) => (p.maxIcalFeeds === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${p.maxIcalFeeds} ${isEn ? 'feeds' : 'luồng'}`)),
        },
        {
          label: isEn ? 'Direct 2-way API Channel Manager' : 'Kết nối API 2 chiều trực tiếp (Direct Channel Manager)',
          cells: fullPlans.map((p) => p.hasDirectApiChannels),
        },
      ],
    },
    {
      title: isEn ? '5. Online Payments & Automated Deposits' : '5. Thanh toán & Đặt cọc trực tuyến',
      rows: [
        {
          label: isEn ? 'PayOS VietQR dynamic payment gateway' : 'Cổng thanh toán VietQR PayOS tự động 24/7',
          cells: fullPlans.map((p) => p.hasPayOsOnlineDeposit),
        },
        {
          label: isEn ? 'Instant automated booking deposit hold' : 'Nhận tiền cọc giữ phòng tự động tức thì',
          cells: fullPlans.map(() => true),
        },
        {
          label: isEn ? 'Real-time VietQR reconciliation' : 'Tự động đối soát giao dịch thời gian thực',
          cells: fullPlans.map(() => true),
        },
      ],
    },
    {
      title: isEn ? '6. Financial Cashbook & E-Invoices' : '6. Tài chính, Sổ quỹ & Hóa đơn điện tử',
      rows: [
        {
          label: isEn ? 'Front-desk cashbook & cashflow tracking' : 'Quản lý sổ quỹ thu chi tiền mặt lễ tân',
          cells: fullPlans.map((p) => p.hasCashbookReports),
        },
        {
          label: isEn ? 'Advanced financial & revenue analytics' : 'Báo cáo phân tích doanh thu & công suất phòng chuyên sâu',
          cells: fullPlans.map((p) => p.hasAdvancedAnalytics),
        },
        {
          label: isEn ? 'Excel / CSV raw data export' : 'Xuất dữ liệu báo cáo ra file Excel / CSV',
          cells: fullPlans.map((p) => p.allowDataExport),
        },
        {
          label: isEn ? 'Mắt Bão VAT e-invoices included' : 'Hóa đơn điện tử GTGT Mắt Bão tặng kèm',
          cells: fullPlans.map((p) => (p.invoices === 0 ? (isEn ? 'None' : 'Không có') : `${p.invoices} ${isEn ? 'invoices/mo' : 'hóa đơn/tháng'}`)),
        },
      ],
    },
    {
      title: isEn ? '7. Storage & Media Uploads' : '7. Lưu trữ ảnh & Tài nguyên đa phương tiện',
      rows: [
        {
          label: isEn ? 'High-speed cloud storage quota' : 'Dung lượng lưu trữ ảnh & media đám mây',
          cells: fullPlans.map((p) => (p.maxStorageMb >= 1024 ? `${p.maxStorageMb / 1024} GB` : `${p.maxStorageMb} MB`)),
        },
        {
          label: isEn ? 'Max single photo upload size' : 'Kích thước tải lên tối đa mỗi ảnh',
          cells: fullPlans.map((p) => `${p.maxImageUploadSizeMb} MB`),
        },
      ],
    },
    {
      title: isEn ? '8. Customer Support & SLA Commitment' : '8. Dịch vụ & Hỗ trợ kỹ thuật (SLA)',
      rows: [
        {
          label: isEn ? 'Support priority level' : 'Cấp độ ưu tiên hỗ trợ kỹ thuật',
          cells: fullPlans.map((p) =>
            p.supportPriority === 'DEDICATED'
              ? (isEn ? 'Dedicated 24/7' : 'Chuyên trách 24/7')
              : p.supportPriority === 'PRIORITY'
                ? (isEn ? 'Priority' : 'Ưu tiên phản hồi nhanh')
                : (isEn ? 'Standard' : 'Tiêu chuẩn')
          ),
        },
        {
          label: isEn ? 'Dedicated 1-on-1 Onboarding specialist' : 'Chuyên viên hướng dẫn setup 1-1 ban đầu',
          cells: fullPlans.map((p) => p.hasDedicatedOnboarding),
        },
        {
          label: isEn ? 'Free trial period (No credit card required)' : 'Thời gian dùng thử miễn phí không ràng buộc',
          cells: fullPlans.map((p) => `${p.trialDays} ${isEn ? 'days' : 'ngày'}`),
        },
      ],
    },
  ]

  return (
    <>
      <MarketingHeader active="pricing" />
      <main>
        {/* Title, monthly / yearly switch and the dynamic plans */}
        <section className={cn(frame, 'pt-10 lg:pt-14')}>
          <PlanCards
            title={t('title')}
            plans={fullPlans.map((p) => {
              const yearlyP = p.priceYearly || p.price * 10
              const annualSavings = p.price * 12 - yearlyP
              return {
                id: p.id,
                name: p.name,
                fit: p.description || (tp.has(`${p.id}.fit` as any) ? tp(`${p.id}.fit` as any) : ''),
                monthly: formatVnd(p.price, locale),
                yearly: formatVnd(yearlyP, locale),
                saving: t('billing.saving', { amount: formatVnd(annualSavings, locale) }),
                isFeatured: p.isFeatured,
                trialDays: p.trialDays,
                limits: [
                  {
                    label: isEn ? 'Properties' : 'Cơ sở lưu trú',
                    value: p.properties === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${p.properties} ${isEn ? 'properties' : 'cơ sở'}`,
                    muted: false,
                  },
                  {
                    label: isEn ? 'Rooms limit' : 'Quy mô phòng',
                    value: p.rooms === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${n.format(p.rooms)} ${isEn ? 'rooms' : 'phòng'}`,
                    muted: false,
                  },
                  {
                    label: isEn ? 'Staff accounts' : 'Tài khoản nhân sự',
                    value: p.staff === -1 ? (isEn ? 'Unlimited' : 'Không giới hạn') : `${p.staff} ${isEn ? 'staff' : 'nhân viên'}`,
                    muted: false,
                  },
                  {
                    label: isEn ? 'Custom domain' : 'Tên miền riêng',
                    value: p.hasCustomDomain ? (isEn ? 'Included' : 'Được hỗ trợ') : (isEn ? 'Subdomain only' : 'Tên miền con'),
                    muted: !p.hasCustomDomain,
                  },
                  {
                    label: isEn ? 'AI & Chatbot' : 'Trí tuệ nhân tạo AI',
                    value: `${p.monthlyAiContentQuota} ${isEn ? 'AI articles/mo' : 'bài/tháng'}${p.hasChatbotAi ? ` · Chatbot` : ''}`,
                    muted: false,
                  },
                  {
                    label: isEn ? 'VAT E-invoices' : 'HĐĐT Mắt Bão',
                    value: p.invoices === 0 ? (isEn ? 'Not included' : 'Không tặng kèm') : `${p.invoices} ${isEn ? 'invoices/mo' : 'hóa đơn/tháng'}`,
                    muted: p.invoices === 0,
                  },
                ],
              }
            })}
            labels={{
              billing: t('billing.label'),
              monthly: t('billing.monthly'),
              yearly: t('billing.yearly'),
              badge: t('billing.badge', { months: 12 - YEARLY_MONTHS }),
              perMonth: tp('perMonth'),
              perYear: tp('perYear'),
              fit: t('fit'),
              choose: t('choose'),
              featured: isEn ? 'Most Popular' : 'Được tin dùng nhất',
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

        {/* 8-Group Full Comparison Matrix */}
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
                  <th scope="col" className="w-[36%] px-7 py-[18px] text-left text-[13px] font-normal text-muted">
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
                    <th colSpan={1 + fullPlans.length} scope="colgroup" className="border-b border-line/70 px-7 pb-3 pt-5 text-left text-label font-semibold uppercase text-primary">
                      {g.title}
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.label} className="border-b border-line/70 last:border-b-0 hover:bg-fg/[0.015] transition-colors">
                      <th scope="row" className="px-7 py-[15px] text-left font-normal text-fg">
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

        {/* Enterprise Trust & DIGISO Guarantees */}
        <section className={cn(frame, 'pt-20 lg:pt-28')}>
          <div data-reveal className="rounded-box border border-line bg-panel p-6 sm:p-8 lg:p-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line/70 pb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  DIGISO Digital Solutions Co., Ltd.
                </span>
                <h3 className="mt-1 font-serif text-[24px] sm:text-[28px] font-medium leading-[1.2] text-fg">
                  {t('trust.title')}
                </h3>
              </div>
              <a
                href="tel:0877909606"
                className={cn(lineButton, 'h-11 px-5 text-sm font-semibold text-primary hover:bg-primary/10 shrink-0 self-start sm:self-auto')}
              >
                {t('trust.hotlineAction')}
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  {t('trust.invoiceTitle')}
                </h4>
                <p className="text-xs leading-relaxed text-muted">
                  {t('trust.invoiceDesc')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  {t('trust.hotlineTitle')}
                </h4>
                <p className="text-xs leading-relaxed text-muted">
                  {t('trust.hotlineDesc')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  {t('trust.ecosystemTitle')}
                </h4>
                <p className="text-xs leading-relaxed text-muted">
                  {t('trust.ecosystemDesc')}
                </p>
              </div>
            </div>
          </div>
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
