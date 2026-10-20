'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageContainer } from '@/components/layout'
import { Alert, AlertDescription, BookingStatusBadge, Loading } from '@/components/ui'
import { BookingActions, BookingDetailContent, useBooking } from '@/components/bookings/booking-detail'
import { formatDateTime, sourceLabel } from '@/lib/bookings/display'
import { routes } from '@/lib/utils/routes'

/**
 * A booking on its own page (links, printing, opening in a new tab). Same
 * content and actions as the side panel on the bookings list.
 */
export default function BookingDetailPage() {
  const params = useParams<{ slug: string; id: string; bookingId: string }>()
  const { booking, error, reload } = useBooking(params.bookingId)
  const listHref = routes.propertyBookings(params.slug, params.id)

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href={listHref}
        className="inline-flex items-center gap-1.5 mb-4 text-small text-muted hover:text-fg focus:outline-none focus-visible:underline"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Đặt phòng
      </Link>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !booking ? (
        <Loading className="py-16" text="Đang tải đặt phòng…" />
      ) : (
        <>
          <div className="mb-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-[22px] leading-8 font-semibold text-fg">{booking.bookingCode}</h1>
              <BookingStatusBadge status={booking.status} size="md" />
            </div>
            <p className="mt-1 text-small text-muted">
              {booking.property.name} · {sourceLabel(booking.source)} · đặt lúc {formatDateTime(booking.createdAt)}
            </p>
          </div>

          <div className="rounded-box border border-line bg-panel">
            <div className="px-5 sm:px-6 py-5">
              <BookingDetailContent booking={booking} onChanged={reload} />
            </div>
            <div className="sticky bottom-0 flex items-center gap-2 px-5 sm:px-6 py-3 border-t border-line bg-panel rounded-b-box">
              <BookingActions booking={booking} onChanged={reload} />
            </div>
          </div>
        </>
      )}
    </PageContainer>
  )
}
