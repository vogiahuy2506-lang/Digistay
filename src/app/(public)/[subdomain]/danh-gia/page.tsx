import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/db'
import { readReviewToken } from '@/lib/reviews/review-token'
import { BookingFooter, BookingHeader, loadBookingFrame } from '../_components/booking/frame'
import { ReviewForm } from './ReviewForm'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ token?: string }>
}

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ReviewPage({ params, searchParams }: PageProps) {
  const { subdomain } = await params
  const { token } = await searchParams

  const frame = await loadBookingFrame(subdomain, { guestLink: true })
  if (!frame) notFound()

  const t = await getTranslations('site.reviewPage')

  const bookingId = token ? readReviewToken(token) : null
  const booking = bookingId
    ? await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          bookingItems: {
            select: {
              roomTypeId: true,
            },
          },
          review: {
            select: {
              rating: true,
              title: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      })
    : null

  let roomName = 'Phòng nghỉ'
  if (booking && booking.bookingItems[0]?.roomTypeId) {
    const rt = await prisma.roomType.findUnique({
      where: { id: booking.bookingItems[0].roomTypeId },
      select: { name: true },
    })
    if (rt) roomName = rt.name
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <BookingHeader frame={frame} />

      <main className="flex-1 flex flex-col justify-center">
        {!booking || !token ? (
          <div className="max-w-md mx-auto py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-fg mb-2">{t('invalidToken')}</h2>
            <p className="text-sm text-muted mb-6 leading-relaxed">{t('invalidTokenDesc')}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-acc text-white text-sm font-medium hover:bg-acc/90 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('backToHome')}</span>
            </Link>
          </div>
        ) : (
          <ReviewForm
            ticket={token}
            subdomain={subdomain}
            hotelName={booking.property.name}
            hotelLogo={booking.property.logo}
            roomName={roomName}
            guestName={booking.guestName}
            checkIn={booking.checkInDate.toISOString()}
            checkOut={booking.checkOutDate.toISOString()}
            alreadyReviewed={Boolean(booking.review)}
            existingReview={
              booking.review
                ? {
                    ...booking.review,
                    createdAt: booking.review.createdAt.toISOString(),
                  }
                : null
            }
          />
        )}
      </main>

      <BookingFooter property={frame.property} />
    </div>
  )
}
