import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@/i18n/locales'
import { prisma } from '@/lib/db'
import { formatVnd } from '@/lib/bookings/display'
import { depositToken } from '@/lib/payments/deposit-link'
import { SiteLink } from '../_components/site-base'
import { WaitForPayment } from './WaitForPayment'

interface PageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ status?: string; cancel?: string; orderCode?: string }>
}

export const dynamic = 'force-dynamic'
// A guest's payment status, not a page to find in a search engine.
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * Where PayOS sends the guest back after paying or cancelling (Part 5),
 * from a staff link or a deposit taken when booking on the site.
 * Display only: it shows the payment as our database has it (the webhook
 * marks it paid), never what the query string claims. The order code is a
 * 16-digit random number, so it only finds the guest's own payment, and
 * the page shows nothing about them beyond the booking code and amount.
 */
export default async function PaymentReturnPage({ params, searchParams }: PageProps) {
  const { subdomain } = await params
  const { status, cancel, orderCode } = await searchParams

  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: { id: true, name: true, phone: true },
  })
  if (!property) notFound()

  const payment = /^\d{1,20}$/.test(orderCode ?? '')
    ? await prisma.payment.findFirst({
        where: { propertyId: property.id, gatewayOrderCode: orderCode },
        select: { status: true, amount: true, metadata: true, booking: { select: { id: true, bookingCode: true, status: true } } },
      })
    : null
  const paid = payment?.status === 'PAID'
  // A deposit taken on the site emails the guest once paid (payos.ts).
  const deposit = (payment?.metadata as { guestDeposit?: boolean } | null)?.guestDeposit === true
  const cancelled = !paid && (cancel === 'true' || status === 'CANCELLED')
  // Cancelled at the hotel's deposit deadline (guest-deposit.ts).
  const expired = !paid && payment?.booking.status === 'CANCELLED'
  // Left PayOS without paying a deposit that still holds the room: pay again (dat-coc).
  const payAgain = cancelled && deposit && payment?.booking.status === 'PENDING'

  const rawLocale = await getLocale()
  const locale = isLocale(rawLocale) ? rawLocale : 'vi'
  const t = await getTranslations({ locale, namespace: 'site.paymentReturn' })

  const title = paid
    ? t('titlePaid')
    : expired
      ? t('titleExpired')
      : cancelled
      ? t('titleCancelled')
      : payment
        ? t('titleWaiting')
        : t('titleThanks')
  const body = expired
    ? t('bodyExpired', { code: payment!.booking.bookingCode, hotel: property.name })
    : paid
    ? t('bodyPaid', {
        hotel: property.name,
        amount: formatVnd(payment.amount),
        code: payment.booking.bookingCode,
        deposit: deposit ? t('bodyPaidDepositSuffix') : '',
      })
    : cancelled
      ? t('bodyCancelled', {
          hotel: property.name,
          retained: payment ? t('bodyCancelledRetained', { code: payment.booking.bookingCode }) : '',
        })
      : payment
        ? t('bodyWaiting', { hotel: property.name, code: payment.booking.bookingCode })
        : t('bodyFallback', { hotel: property.name })

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full border border-line bg-raised p-8 text-center space-y-4 shadow-lift">
        <h1 className="font-site text-2xl font-semibold text-fg">{title}</h1>
        <p className="text-muted">{body}</p>
        {payment && !paid && !cancelled && !expired && <WaitForPayment />}
        {payAgain && (
          <SiteLink
            path={`/dat-coc/${depositToken(payment.booking.id)}`}
            className="inline-flex h-11 items-center rounded-ctl border border-line px-6 text-small font-medium text-fg hover:bg-fg/[0.03]"
          >
            {t('payAgain')}
          </SiteLink>
        )}
        {property.phone && <p className="text-small text-muted">{t('contactHotel', { phone: property.phone })}</p>}
        <SiteLink
          path="/"
          className="inline-flex h-11 items-center rounded-ctl bg-ink px-6 text-small font-medium text-on-ink hover:bg-ink/90"
        >
          {t('backToHotel')}
        </SiteLink>
      </div>
    </main>
  )
}
