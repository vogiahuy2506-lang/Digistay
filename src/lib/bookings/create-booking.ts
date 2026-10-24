/**
 * Creating a booking, the one path for staff (POST /api/bookings) and guests
 * on the hotel's site (POST /api/public/bookings).
 *
 * - Priced by src/lib/pricing/quote.ts on the server, from the room type's
 *   own rates: the quote the guest saw is what the booking is charged.
 *   subtotal = room nights, extraCharges = surcharges + services, total =
 *   their sum (prices include VAT).
 * - Capacity by src/lib/bookings/occupancy.ts, under a row lock on the room
 *   type, so two requests for the last room cannot both succeed. A guest's
 *   own hold is not counted against them, and is released by the booking.
 * - The confirmation and the owner's notice are queued in the same
 *   transaction (src/lib/email/outbox.ts). The guest's is in the booking's
 *   language and links to the site's pages in it; the owner's is Vietnamese.
 * - Never creates a payment: a guest cannot record money (Part 1).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { Locale } from '@/i18n/locales'
import { emailLocale } from '@/lib/email/i18n'
import { queueBookingConfirmation, queueOwnerNewBooking } from '@/lib/email/outbox'
import { appSiteUrl } from '@/lib/public-site/paths'
import { depositFor, quoteStay, ratesFrom, type PricedService } from '@/lib/pricing/quote'
import { depositUrl } from '@/lib/payments/deposit-link'
import { NO_PRICE_MESSAGE, ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { lockRoomType, roomsTaken } from './occupancy'

type Tx = Prisma.TransactionClient

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
    this.name = 'BookingError'
  }
}

export interface NewBooking {
  propertyId: string
  roomTypeId: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestNote?: string | null
  checkIn: Date
  checkOut: Date
  numAdults: number
  numChildren: number
  roomNumber?: string | null
  vat?: { company?: string | null; taxCode?: string | null; address?: string | null; email?: string | null }
  services?: { serviceId: string; quantity: number }[]
  /** the staff member; null for a guest */
  createdById?: string | null
  /** the guest's hold (RoomLock id from /api/bookings/room-lock) */
  holdId?: string | null
  /** The hotel's online deposit (guest-deposit.ts): the email carries the link to pay it. */
  deposit?: { percent: number; deadlineMinutes: number } | null
  /** The language of the page the guest booked on: their emails follow it. Staff bookings: 'vi'. */
  locale?: Locale
}

/** The room type, its rates and the chosen services, or a BookingError. */
export async function priceBooking(input: NewBooking, db: Tx | typeof prisma = prisma) {
  const roomType = await db.roomType.findFirst({
    where: { id: input.roomTypeId, propertyId: input.propertyId, isActive: true },
    include: ROOM_RATE_INCLUDE,
  })
  if (!roomType) throw new BookingError('Không tìm thấy hạng phòng', 404)
  const rates = ratesFrom(roomType.pricing[0], await propertyRateDefaults(db, input.propertyId))
  if (!rates) throw new BookingError(NO_PRICE_MESSAGE, 400)

  const wanted = input.services ?? []
  const services: PricedService[] = wanted.length
    ? await db.extraService.findMany({
        where: { id: { in: wanted.map((s) => s.serviceId) }, propertyId: input.propertyId, isActive: true },
        select: { id: true, name: true, price: true, priceType: true, perPerson: true },
      })
    : []
  if (services.length !== new Set(wanted.map((s) => s.serviceId)).size) {
    throw new BookingError('Có dịch vụ không còn được cung cấp, vui lòng chọn lại', 400)
  }

  const quote = quoteStay({
    rates,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    numAdults: input.numAdults,
    numChildren: input.numChildren,
    baseOccupancy: roomType.baseOccupancy,
    services: wanted.map((w) => ({ service: services.find((s) => s.id === w.serviceId)!, quantity: w.quantity })),
  })
  return { roomType, rates, quote }
}

const BOOKING_EMAIL_INCLUDE = {
  property: {
    select: {
      id: true,
      name: true,
      subdomain: true,
      address: true,
      phone: true,
      city: true,
      policy: { select: { checkInTime: true, checkOutTime: true } },
      workspace: { select: { slug: true, owner: { select: { email: true, name: true } } } },
    },
  },
} satisfies Prisma.BookingInclude

type BookingForEmails = Prisma.BookingGetPayload<{ include: typeof BOOKING_EMAIL_INCLUDE }>

/** The guest's confirmation and the owner's notice, queued (src/lib/email/outbox.ts). */
async function queueBookingEmails(tx: Tx, booking: BookingForEmails, deposit?: NewBooking['deposit']) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const prop = booking.property
  const locale = emailLocale(booking.locale)
  // The link to pay the deposit later; without it the email still goes (never fail a booking over it).
  let payUrl: string | null = null
  if (deposit) {
    try {
      payUrl = depositUrl(prop.subdomain, booking.id, locale)
    } catch (error) {
      console.error('[booking] no deposit link for the email:', error)
    }
  }
  // No staff member: the guest booked on the hotel's site, and the hotel has
  // not confirmed yet. The emails must not say the room is booked.
  const fromWebsite = booking.createdById === null
  const ids: string[] = []
  // A walk-in booked by staff may have no email.
  if (booking.guestEmail) ids.push(
    await queueBookingConfirmation(
      {
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        bookingCode: booking.bookingCode,
        propertyName: prop.name,
        propertyAddress: `${prop.address}, ${prop.city}`,
        propertyPhone: prop.phone,
        checkIn: booking.checkInDate.toISOString(),
        checkOut: booking.checkOutDate.toISOString(),
        numAdults: booking.numAdults,
        numChildren: booking.numChildren,
        totalAmount: booking.totalAmount,
        propertyUrl: appSiteUrl(site, prop.subdomain, locale),
        checkInTime: prop.policy?.checkInTime,
        checkOutTime: prop.policy?.checkOutTime,
        awaitingConfirmation: fromWebsite,
        // Also to pay it later, after leaving PayOS (dat-coc page, deposit-link.ts).
        ...(deposit && payUrl && {
          deposit: {
            amount: depositFor(booking.totalAmount, deposit.percent),
            url: payUrl,
            ...(deposit.deadlineMinutes > 0 && { deadline: new Date(Date.now() + deposit.deadlineMinutes * 60_000) }),
          },
        }),
        locale,
      },
      booking.id,
      tx
    )
  )
  const owner = prop.workspace?.owner
  if (owner?.email) {
    ids.push(
      await queueOwnerNewBooking(
        {
          ownerEmail: owner.email,
          ownerName: owner.name ?? undefined,
          bookingCode: booking.bookingCode,
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          guestEmail: booking.guestEmail,
          propertyName: prop.name,
          checkIn: booking.checkInDate.toISOString(),
          checkOut: booking.checkOutDate.toISOString(),
          manageUrl: `${site}/workspace/${prop.workspace.slug}/properties/${prop.id}/bookings/${booking.id}`,
          fromWebsite,
        },
        booking.id,
        tx
      )
    )
  }
  return ids
}

function bookingCode() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `DS${timestamp}${random}`
}

/** Prices, checks capacity and creates the booking; queues its emails. */
export async function createBooking(input: NewBooking) {
  if (!(input.checkOut.getTime() > input.checkIn.getTime())) {
    throw new BookingError('Ngày trả phòng phải sau ngày nhận phòng', 400)
  }
  const { roomType, quote } = await priceBooking(input)

  return prisma.$transaction(async (tx) => {
    await lockRoomType(tx, roomType.id)
    const taken = await roomsTaken(tx, roomType.id, {
      propertyId: input.propertyId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      ownHoldId: input.holdId,
    })
    if (taken >= roomType.totalRooms) throw new BookingError('Phòng đã hết trong khoảng ngày này', 409)

    const booking = await tx.booking.create({
      data: {
        bookingCode: bookingCode(),
        propertyId: input.propertyId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        guestNote: input.guestNote ?? null,
        checkInDate: input.checkIn,
        checkOutDate: input.checkOut,
        numAdults: input.numAdults,
        numChildren: input.numChildren,
        status: 'PENDING',
        subtotal: quote.basePrice,
        extraCharges: quote.extraCharges,
        totalAmount: quote.total,
        depositAmount: 0,
        source: 'DIRECT',
        createdById: input.createdById ?? null,
        locale: input.locale ?? 'vi',
        vatCompany: input.vat?.company || null,
        vatTaxCode: input.vat?.taxCode || null,
        vatAddress: input.vat?.address || null,
        vatEmail: input.vat?.email || null,
        ...(quote.services.length > 0 && { services: quote.services as unknown as Prisma.InputJsonValue }),
        bookingItems: {
          create: {
            roomTypeId: roomType.id,
            roomNumber: input.roomNumber ?? null,
            checkInDate: input.checkIn,
            checkOutDate: input.checkOut,
            basePrice: quote.basePrice,
            extraAdultPrice: quote.extraAdultCharge,
            extraChildPrice: quote.extraChildCharge,
            totalPrice: quote.basePrice + quote.extraAdultCharge + quote.extraChildCharge,
          },
        },
      },
      include: { bookingItems: true, ...BOOKING_EMAIL_INCLUDE },
    })
    // The guest's hold has done its job.
    if (input.holdId) {
      // Scoped: the id comes from the browser, and must not release another
      // hotel's or another room type's hold.
      await tx.roomLock.deleteMany({
        where: { id: input.holdId, type: 'HOLD', bookingId: null, propertyId: input.propertyId, roomTypeId: roomType.id },
      })
    }
    const emailIds = await queueBookingEmails(tx, booking, input.deposit)
    return { booking, emailIds, quote }
  })
}
