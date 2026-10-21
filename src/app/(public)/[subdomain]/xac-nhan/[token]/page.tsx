import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { formatVnd } from '@/lib/bookings/display'
import { loadDepositView } from '@/lib/payments/deposit-view'
import { BookingFooter, BookingHeader, BookingSteps, loadBookingFrame } from '../../_components/booking/frame'
import { SiteLink } from '../../_components/site-base'
import { StaySummary } from '../../_components/booking/StaySummary'
import { Container, bedLabel } from '../../_components/site-ui'
import { bookedLines } from '../../_components/booking/booked-lines'
import { CopyCode, EmailSentLine } from './ConfirmationBits'

interface PageProps {
  params: Promise<{ subdomain: string; token: string }>
}

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * Step 4, the booking is in (Claude Design "Digistay Xac Nhan"): its code,
 * deposited or waiting for the hotel, the stay and the amounts. A deposit
 * still to pay, or a booking cancelled, is the deposit page's to show.
 */
export default async function ConfirmationPage({ params }: PageProps) {
  const { subdomain, token } = await params
  const [frame, view] = await Promise.all([loadBookingFrame(subdomain, { guestLink: true }), loadDepositView(subdomain, token)])
  if (!frame || !view) notFound()
  const t = await getTranslations('site')
  const lang = (await getLocale()) === 'en' ? 'en' : 'vi'

  if (view.state !== 'paid' && view.state !== 'none') {
    // Not confirmed yet: pay (or see why it was cancelled) on the deposit page.
    return (
      <>
        <BookingHeader frame={frame} />
        <main>
          <BookingSteps current={3} />
          <Container className="pt-12">
            <SiteLink path={`/dat-coc/${token}`} className="inline-flex h-[48px] items-center bg-ink px-6 text-[14px] font-medium text-on-ink">
              {t('booking.deposit.pendingTitle')} →
            </SiteLink>
          </Container>
        </main>
        <BookingFooter property={frame.property} />
      </>
    )
  }

  const deposited = view.state === 'paid' && view.amounts.deposit > 0
  // No online deposit, and the hotel has confirmed it.
  const confirmed = !deposited && view.bookingStatus !== 'PENDING'
  const phone = view.property.phone

  return (
    <>
      <BookingHeader frame={frame} />
      <main>
        <BookingSteps current={4} />
        <Container className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-20 lg:pt-14">
          <div className="min-w-0">
            <span className={deposited || confirmed ? 'inline-flex items-center gap-2 bg-ok-soft px-3 py-1.5 text-[13px] font-semibold text-ok' : 'inline-flex items-center gap-2 bg-warn-soft px-3 py-1.5 text-[13px] font-semibold text-warn'}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              {deposited ? t('booking.done.depositedChip') : confirmed ? t('booking.done.confirmedChip') : t('booking.done.waitingChip')}
            </span>
            <h1 className="mt-5 text-balance font-site text-[36px] leading-[1.08] text-fg lg:text-[56px]">{t('booking.done.title', { hotel: view.property.name })}</h1>
            <p className="mt-4 max-w-[640px] text-[16px] leading-[1.7] text-fg/80 lg:text-[17px]">
              {deposited
                ? t('booking.done.depositedLead', { amount: formatVnd(view.amounts.deposit, lang) })
                : confirmed
                  ? t('booking.done.confirmedLead', { hotel: view.property.name })
                  : t('booking.done.waitingLead', { hotel: view.property.name })}
            </p>

            <div className="mt-8 flex flex-col gap-4 border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
              <div>
                <p className="text-label uppercase text-muted">{t('booking.done.code')}</p>
                <p className="mt-2 font-mono text-[36px] font-medium leading-none tracking-[0.04em] text-fg lg:text-[48px]">{view.bookingCode}</p>
                <p className="mt-3 text-[13px] text-muted">{t('booking.done.codeHint')}</p>
              </div>
              <CopyCode code={view.bookingCode} />
            </div>

            <div className="mt-6">
              <EmailSentLine token={token} />
            </div>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex h-[52px] items-center justify-center bg-ink px-7 text-[15px] font-medium text-on-ink">
                  {t('booking.done.callHotel', { phone })}
                </a>
              )}
              <SiteLink path="/" className="flex h-[52px] items-center justify-center border border-ink px-6 text-[15px] font-medium text-fg">
                {t('booking.common.home')}
              </SiteLink>
            </div>
          </div>
          <div>
            <StaySummary
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
              deposit={deposited ? { amount: view.amounts.deposit, paid: true } : null}
            />
          </div>
        </Container>
      </main>
      <BookingFooter property={frame.property} />
    </>
  )
}
