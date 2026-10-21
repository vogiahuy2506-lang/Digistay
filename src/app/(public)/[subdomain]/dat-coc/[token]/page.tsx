import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { getTranslations } from 'next-intl/server'
import { loadDepositView } from '@/lib/payments/deposit-view'
import { BookingFooter, BookingHeader, BookingSteps, loadBookingFrame } from '../../_components/booking/frame'
import { StaySummary } from '../../_components/booking/StaySummary'
import { bookedLines } from '../../_components/booking/booked-lines'
import { Container, bedLabel } from '../../_components/site-ui'
import { DepositLive } from './DepositLive'

interface PageProps {
  params: Promise<{ subdomain: string; token: string }>
}

export const dynamic = 'force-dynamic'
// A guest's own link: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * Step 3, the guest pays their deposit (Claude Design "Digistay Dat Coc
 * PayOS"): the PayOS VietQR right on the hotel's site, with the account,
 * amount and transfer message, until the webhook marks it paid. Also the
 * link in the booking email (src/lib/payments/deposit-link.ts). Showing it
 * changes nothing (mail scanners open links).
 */
export default async function DepositPage({ params }: PageProps) {
  const { subdomain, token } = await params
  const [frame, view] = await Promise.all([loadBookingFrame(subdomain, { guestLink: true }), loadDepositView(subdomain, token)])
  if (!frame || !view) notFound()
  const t = await getTranslations('site')

  const qrImage = view.payment?.qr ? await QRCode.toDataURL(view.payment.qr, { margin: 1, width: 560, errorCorrectionLevel: 'M' }) : null
  const titles = {
    pending: t('booking.deposit.pendingTitle'),
    paid: t('booking.deposit.paidTitle'),
    none: t('booking.deposit.paidTitle'),
    expired: t('booking.deposit.expiredTitle'),
    cancelled: t('booking.deposit.cancelledTitle'),
    error: t('booking.deposit.errorTitle'),
  }

  return (
    <>
      <BookingHeader frame={frame} />
      <main>
        <BookingSteps current={3} />
        <Container className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 lg:pt-12">
          <div className="min-w-0">
            <p className="text-[13.5px] text-muted">
              {t('booking.deposit.code')} <b className="font-mono font-semibold text-fg">{view.bookingCode}</b>
            </p>
            <h1 className="mt-2 font-site text-[32px] leading-[1.1] text-fg lg:text-[48px]">{titles[view.state]}</h1>
            <div className="mt-7">
              <DepositLive
                token={token}
                state={view.state}
                amount={view.payment?.amount ?? view.amounts.deposit}
                qrImage={qrImage}
                checkoutUrl={view.payment?.checkoutUrl ?? null}
                expiresAt={view.payment?.expiresAt?.toISOString() ?? null}
                deadline={view.payment?.deadline?.toISOString() ?? null}
                transfer={view.transfer}
                hadDeposit={!!view.payment}
                hotel={{ name: view.property.name, phone: view.property.phone }}
              />
            </div>
          </div>
          <div>
            <StaySummary
              compact
              room={view.room && { name: view.room.name, image: view.room.image, spec: view.room.bedType ? bedLabel(view.room.bedType, t) : '' }}
              checkIn={view.checkIn}
              checkOut={view.checkOut}
              checkInTime={view.property.checkInTime}
              checkOutTime={view.property.checkOutTime}
              nights={view.nights}
              adults={view.adults}
              children={view.children}
              lines={bookedLines(view, t)}
              total={view.amounts.total}
              deposit={view.amounts.deposit > 0 ? { amount: view.amounts.deposit, paid: view.state === 'paid' } : null}
              note={view.property.cancellationHours != null ? t('booking.deposit.cancellation', { hours: view.property.cancellationHours }) : undefined}
            />
          </div>
        </Container>
      </main>
      <BookingFooter property={frame.property} />
    </>
  )
}
