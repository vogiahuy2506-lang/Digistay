import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { localized, localizeRow } from '@/lib/i18n/content'
import { prisma } from '@/lib/db'
import { heldBySession, roomsTakenByType } from '@/lib/bookings/occupancy'
import { HOLD_COOKIE, holdSessionId } from '@/lib/bookings/hold-session'
import { onlineDepositOf } from '@/lib/payments/guest-deposit'
import { ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { ratesFrom } from '@/lib/pricing/quote'
import { BookingFooter, BookingHeader, BookingSteps, loadBookingFrame } from '../_components/booking/frame'
import { SiteLink } from '../_components/site-base'
import { Container, roomMeta } from '../_components/site-ui'
import { BookingForm } from './BookingForm'

interface PageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

const DAY = /^\d{4}-\d{2}-\d{2}$/
const count = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/**
 * Step 2, the booking itself (Claude Design "Digistay Dat Phong"): one room
 * type for one stay, from the results page. Checked here: the room type
 * exists, has a price, takes these guests and has a room free; the booking
 * route checks it all again.
 */
export default async function BookingPage({ params, searchParams }: PageProps) {
  const { subdomain } = await params
  const q = await searchParams
  const frame = await loadBookingFrame(subdomain)
  if (!frame) notFound()
  const t = await getTranslations('site')
  const propertyId = frame.property.id

  const checkIn = q.checkIn && DAY.test(q.checkIn) ? q.checkIn : ''
  const checkOut = q.checkOut && DAY.test(q.checkOut) ? q.checkOut : ''
  const adults = count(q.adults, 2, 1, 20)
  const children = count(q.children, 0, 0, 10)

  const [roomType, defaults, policy, services, deposit] = await Promise.all([
    q.room
      ? prisma.roomType.findFirst({
          where: { id: q.room, propertyId, isActive: true },
          include: { images: { where: { isPrimary: true }, take: 1 }, ...ROOM_RATE_INCLUDE },
        })
      : null,
    propertyRateDefaults(prisma, propertyId),
    prisma.policy.findUnique({ where: { propertyId } }),
    prisma.extraService.findMany({
      where: { propertyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, description: true, price: true, priceType: true, perPerson: true, translations: true },
    }),
    onlineDepositOf(propertyId),
  ])

  const lang = (await getLocale()) === 'en' ? 'en' : 'vi'
  const rates = roomType ? ratesFrom(roomType.pricing[0], defaults) : null
  const validDates = !!checkIn && !!checkOut && checkOut > checkIn
  // The guest's own hold (a reload, the page opened again) is theirs, not
  // another guest's: left out, as the booking itself leaves it out.
  const ownHoldId =
    roomType && validDates
      ? await heldBySession(prisma, { propertyId, sessionId: holdSessionId((await cookies()).get(HOLD_COOKIE)?.value) })
      : null
  const taken = roomType && validDates
    ? (await roomsTakenByType(prisma, { propertyId, checkIn: new Date(checkIn), checkOut: new Date(checkOut), ownHoldId })).get(roomType.id) ?? 0
    : 0
  const bookable =
    roomType && rates && validDates && roomType.totalRooms - taken > 0 && roomType.maxAdults >= adults && roomType.maxChildren >= children

  const policies: { title: string; text: string }[] = []
  const localPolicy = policy && localizeRow(policy, ['cancellationPolicy'], lang)
  if (localPolicy) {
    const policy = localPolicy
    policies.push({ title: t('policy.checkInOut'), text: t('policy.checkInOutText', { checkIn: policy.checkInTime, checkOut: policy.checkOutTime }) })
    if (policy.cancellationHours != null || policy.cancellationPolicy) {
      policies.push({
        title: t('policy.cancellation'),
        text: [policy.cancellationHours != null ? t('policy.freeCancellation', { hours: policy.cancellationHours }) : null, policy.cancellationPolicy]
          .filter(Boolean)
          .join(' '),
      })
    }
    policies.push({
      title: t('policy.children'),
      text: policy.childrenAllowed
        ? policy.minChildAge > 0
          ? t('policy.childrenFromAge', { age: policy.minChildAge })
          : t('policy.childrenAnyAge')
        : t('policy.noChildren'),
    })
  }

  const back = `/search?${new URLSearchParams({ ...(checkIn && { checkIn }), ...(checkOut && { checkOut }), adults: String(adults), children: String(children) })}`

  return (
    <>
      <BookingHeader frame={frame} />
      <main>
        <BookingSteps current={2} deposit={!!deposit} />
        {bookable ? (
          <BookingForm
            property={{ id: propertyId, name: frame.property.name, phone: frame.property.phone }}
            room={{
              id: roomType.id,
              name: localized(roomType, 'name', lang),
              image: roomType.images[0]?.url ?? null,
              spec: roomMeta(roomType, t),
              baseOccupancy: roomType.baseOccupancy,
            }}
            rates={rates}
            stay={{ checkIn, checkOut, adults, children }}
            services={services.map((s) => {
              const { translations: _, ...service } = localizeRow(s, ['name', 'description'], lang)
              return service
            })}
            policies={policies}
            times={{ checkIn: policy?.checkInTime ?? '14:00', checkOut: policy?.checkOutTime ?? '12:00' }}
            deposit={deposit}
            vatRate={frame.vatRate}
            backPath={back}
          />
        ) : (
          <Container className="pt-12">
            <div className="max-w-[640px] border border-line bg-panel p-6 lg:p-8">
              <p className="text-[17px] font-semibold text-fg">{t('booking.form.unavailable')}</p>
              <SiteLink path={back} className="mt-5 inline-flex h-[46px] items-center bg-ink px-5 text-[14px] font-medium text-on-ink">
                {t('booking.form.backToRooms')}
              </SiteLink>
            </div>
          </Container>
        )}
      </main>
      <BookingFooter property={frame.property} />
    </>
  )
}
