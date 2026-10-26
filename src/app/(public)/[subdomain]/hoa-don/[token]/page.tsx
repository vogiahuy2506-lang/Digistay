import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { formatVnd } from '@/lib/bookings/display'
import { invoicePdfPath } from '@/lib/einvoice/lookup-link'
import { loadInvoiceLookup, type InvoiceLookup } from '@/lib/einvoice/lookup-view'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit } from '@/lib/security/rate-limit'
import { BookingFooter, BookingHeader, loadBookingFrame } from '../../_components/booking/frame'
import { SiteLink } from '../../_components/site-base'
import { Container } from '../../_components/site-ui'

interface PageProps {
  params: Promise<{ subdomain: string; token: string }>
  searchParams: Promise<{ pdf?: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site.invoice')
  // A buyer's own link: never in search results.
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

/** The tax authority's public e-invoice check (seller tax code, series, number); only for real invoices. */
const TAX_PORTAL_URL = 'https://hoadondientu.gdt.gov.vn/'
const VN_TZ = 'Asia/Ho_Chi_Minh'

function issueDate(date: Date, lang: 'vi' | 'en') {
  return lang === 'en'
    ? new Intl.DateTimeFormat('en-GB', { timeZone: VN_TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-[13.5px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] text-fg sm:text-right">{children}</dd>
    </div>
  )
}

/**
 * The public page of an issued invoice (task 39): the link in the invoice
 * email, which staff can also copy. No account needed: the token is the
 * key (src/lib/einvoice/lookup-link.ts). It shows the invoice as printed
 * and offers the PDF; nothing else about the booking or the guest. Opens
 * even when the hotel's site is not published (a guest's own link).
 */
export default async function InvoiceLookupPage({ params, searchParams }: PageProps) {
  const { subdomain, token } = await params
  const { pdf } = await searchParams
  const t = await getTranslations('site.invoice')
  const lang = (await getLocale()) === 'en' ? 'en' : 'vi'

  const byIp = await hit(LIMITS.invoiceLookupIp, getClientIp(await headers()))
  const [frame, invoice] = await Promise.all([
    loadBookingFrame(subdomain, { guestLink: true }),
    byIp.allowed ? loadInvoiceLookup(subdomain, token) : null,
  ])
  if (!frame) notFound()
  if (byIp.allowed && !invoice) notFound()

  return (
    <>
      <BookingHeader frame={frame} />
      <main>
        <Container className="max-w-[920px] pb-16 pt-8 lg:pb-24 lg:pt-14">
          {invoice ? <InvoiceView invoice={invoice} token={token} lang={lang} pdfFailed={pdf === 'failed'} t={t} /> : <p className="border border-line bg-warn-soft p-5 text-[15px] text-warn">{t('tooMany')}</p>}
        </Container>
      </main>
      <BookingFooter property={frame.property} />
    </>
  )
}

function InvoiceView({
  invoice,
  token,
  lang,
  pdfFailed,
  t,
}: {
  invoice: InvoiceLookup
  token: string
  lang: 'vi' | 'en'
  pdfFailed: boolean
  t: Awaited<ReturnType<typeof getTranslations<'site.invoice'>>>
}) {
  const money = (amount: number) => formatVnd(amount, lang)
  const issued = invoice.status === 'PUBLISHED'
  const vat =
    invoice.vatCode == null
      ? null
      : invoice.vatCode === -1
        ? t('vatExempt')
        : invoice.vatCode === -2
          ? t('vatUndeclared')
          : `${invoice.vatCode}%`
  const { buyer, seller } = invoice

  return (
    <>
      <span
        className={
          issued
            ? 'inline-flex items-center gap-2 bg-ok-soft px-3 py-1.5 text-[13px] font-semibold text-ok'
            : 'inline-flex items-center gap-2 bg-info-soft px-3 py-1.5 text-[13px] font-semibold text-info'
        }
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {issued ? t('statusIssued') : t('statusReplaced')}
      </span>
      <h1 className="mt-5 text-balance font-site text-[32px] leading-[1.1] text-fg lg:text-[48px]">
        {invoice.number ? t('title', { number: invoice.number }) : t('titleNoNumber')}
      </h1>
      <p className="mt-4 max-w-[640px] text-[16px] leading-[1.7] text-fg/80">{t('lead', { hotel: seller.name })}</p>

      {invoice.environment === 'DEMO' && (
        <p className="mt-6 border border-warn/40 bg-warn-soft p-4 text-[14px] text-warn">{t('demo')}</p>
      )}
      {pdfFailed && issued && (
        <p role="alert" className="mt-6 border border-err/40 bg-err-soft p-4 text-[14px] text-err">
          {t('pdfFailed')}
        </p>
      )}
      {!issued && (
        <div className="mt-6 border border-info/40 bg-info-soft p-4 text-[14px] text-info">
          <p>{invoice.replacedBy ? t('replacedBy', { number: invoice.replacedBy.number ?? '' }) : t('replacedNoLink')}</p>
          {invoice.replacedBy && (
            <SiteLink path={`/hoa-don/${invoice.replacedBy.token}`} className="mt-2 inline-block font-semibold underline underline-offset-2">
              {t('openReplacement')}
            </SiteLink>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="border border-line bg-panel p-5 lg:p-6">
          <h2 className="text-label uppercase text-muted">{t('seller')}</h2>
          <p className="mt-2 text-[17px] font-semibold text-fg">{seller.name}</p>
          {seller.taxCode && <p className="mt-1 text-[14px] text-fg/80">{t('taxCode', { code: seller.taxCode })}</p>}
          {seller.address && <p className="mt-1 text-[14px] text-fg/80">{seller.address}</p>}
        </section>
        <section className="border border-line bg-panel p-5 lg:p-6">
          <h2 className="text-label uppercase text-muted">{t('buyer')}</h2>
          {buyer.kind === 'company' ? (
            <>
              <p className="mt-2 text-[17px] font-semibold text-fg">{buyer.company}</p>
              {buyer.taxCode && <p className="mt-1 text-[14px] text-fg/80">{t('taxCode', { code: buyer.taxCode })}</p>}
              {buyer.address && <p className="mt-1 text-[14px] text-fg/80">{buyer.address}</p>}
              {buyer.name && <p className="mt-1 text-[14px] text-fg/80">{t('buyerPerson', { name: buyer.name })}</p>}
            </>
          ) : (
            <p className="mt-2 text-[17px] font-semibold text-fg">{buyer.name ?? t('consumer')}</p>
          )}
        </section>
      </div>

      <dl className="mt-4 divide-y divide-line border border-line bg-panel px-5 py-2 lg:px-6">
        <Row label={t('number')}>
          <span className="font-mono font-semibold">{invoice.number ?? '—'}</span>
        </Row>
        <Row label={t('series')}>
          <span className="font-mono">{[invoice.pattern, invoice.series].filter(Boolean).join(' · ') || '—'}</span>
        </Row>
        <Row label={t('date')}>{issueDate(invoice.publishedAt, lang)}</Row>
        {invoice.lookupCode && (
          <Row label={t('lookupCode')}>
            <span className="font-mono">{invoice.lookupCode}</span>
          </Row>
        )}
        {invoice.cqtCode && (
          <Row label={t('cqtCode')}>
            <span className="font-mono">{invoice.cqtCode}</span>
          </Row>
        )}
        {invoice.adjusts && <Row label={t('note')}>{t(invoice.totalAmount < 0 ? 'adjustsDown' : 'adjustsUp', { number: invoice.adjusts })}</Row>}
        {invoice.replaces && <Row label={t('note')}>{t('replaces', { number: invoice.replaces })}</Row>}
        <Row label={t('status')}>{issued ? t('statusIssued') : t('statusReplaced')}</Row>
        <Row label={t('subtotal')}>{money(invoice.subtotal)}</Row>
        <Row label={vat ? t('vat', { rate: vat }) : t('vatNoRate')}>{money(invoice.taxAmount)}</Row>
        <div className="flex items-baseline justify-between gap-6 py-3">
          <dt className="text-[15px] font-semibold text-fg">{t('total')}</dt>
          <dd className="font-site text-[24px] text-fg lg:text-[28px]">{money(invoice.totalAmount)}</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {issued && (
          <a
            href={invoicePdfPath(token, lang)}
            rel="nofollow"
            className="flex h-[52px] items-center justify-center bg-ink px-7 text-[15px] font-medium text-on-ink"
          >
            {t('downloadPdf')}
          </a>
        )}
        {invoice.environment === 'PRODUCTION' && (
          <a
            href={TAX_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex h-[52px] items-center justify-center border border-ink px-6 text-[15px] font-medium text-fg"
          >
            {t('taxPortal')}
          </a>
        )}
      </div>
      {invoice.environment === 'PRODUCTION' && <p className="mt-3 max-w-[640px] text-[13px] text-muted">{t('taxPortalHint')}</p>}
    </>
  )
}
