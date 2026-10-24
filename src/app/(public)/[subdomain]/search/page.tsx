import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { BookingFooter, BookingHeader, BookingSteps, loadBookingFrame } from '../_components/booking/frame'
import { SearchResults, type StayQuery } from './SearchResults'

interface PageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export const dynamic = 'force-dynamic'
// A step of booking, not a page to find in a search engine.
export const metadata: Metadata = { robots: { index: false, follow: false } }

const DAY = /^\d{4}-\d{2}-\d{2}$/
const vnDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86_400_000))
const count = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/** Step 1, rooms free for a stay (Claude Design "Digistay Ket Qua Tim Phong"). An unpublished site is a 404. */
export default async function SearchPage({ params, searchParams }: PageProps) {
  const { subdomain } = await params
  const q = await searchParams
  const frame = await loadBookingFrame(subdomain)
  if (!frame) notFound()
  const policy = await prisma.policy.findUnique({ where: { propertyId: frame.property.id }, select: { checkInTime: true, checkOutTime: true } })

  const checkIn = q.checkIn && DAY.test(q.checkIn) ? q.checkIn : vnDay(0)
  const dayAfter = new Date(Date.parse(`${checkIn}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const checkOut = q.checkOut && DAY.test(q.checkOut) && q.checkOut > checkIn ? q.checkOut : dayAfter
  const initial: StayQuery = {
    checkIn,
    checkOut,
    // ?guests= from older links: all adults.
    adults: count(q.adults ?? q.guests, 2, 1, 20),
    children: count(q.children, 0, 0, 10),
  }

  return (
    <>
      <BookingHeader frame={frame} />
      <main>
        <BookingSteps current={1} />
        <SearchResults
          propertyId={frame.property.id}
          phone={frame.property.phone}
          checkInTime={policy?.checkInTime ?? '14:00'}
          checkOutTime={policy?.checkOutTime ?? '12:00'}
          initial={initial}
        />
      </main>
      <BookingFooter property={frame.property} />
    </>
  )
}
