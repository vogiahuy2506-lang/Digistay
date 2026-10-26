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
import { notifyNewBooking } from '@/lib/notifications'
import { RoomError, assignRoomTx, normalizeRoomNumber, roomConflictMessage, typedRoomNumberConflict } from './rooms'
import { appSiteUrl } from '@/lib/public-site/paths'
import { depositFor, quoteStay, ratesFrom, type PricedService } from '@/lib/pricing/quote'
import { depositUrl } from '@/lib/payments/deposit-link'
import { NO_PRICE_MESSAGE, ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { ROOM_TYPE_PLAN_LOCKED } from '@/lib/billing/guard'
import { formatAddress } from '@/lib/vn-admin/address'
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
  /** one of the hotel's listed rooms, of this room type (rooms.ts) */
  roomId?: string | null
  vat?: { company?: string | null; taxCode?: string | null; address?: string | null; email?: string | null }
  services?: { serviceId: string; quantity: number }[]
  /** the staff member; null for a guest */
  createdById?: string | null
  /** the guest's hold (RoomLock id from /api/bookings/room-lock) */
  holdId?: string | null
  /** The hotel's online deposit (guest-deposit.ts): the email carries the link to pay it. */
  deposit?: { percent: number; deadlineMinutes: number; mode?: 'PAYOS' | 'MANUAL' } | null
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
      ward: true,
      district: true,
      policy: { select: { checkInTime: true, checkOutTime: true } },
      workspace: { select: { slug: true, settings: true, owner: { select: { email: true, name: true } } } },
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
        propertyAddress: formatAddress(prop),
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
            manual: deposit.mode === 'MANUAL',
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
  // The owner may turn these emails off (workspace settings, Thông báo); the bell still shows the booking.
  const notifications = (prop.workspace?.settings as { notifications?: { newBookingEmail?: unknown } } | null)?.notifications
  if (owner?.email && notifications?.newBookingEmail !== false) {
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
  // A room type locked for being over the plan (src/lib/billing/overage.ts)
  // takes no new bookings; its existing ones go on as usual.
  if (roomType.planLockedAt) throw new BookingError(ROOM_TYPE_PLAN_LOCKED, 409)

  return prisma.$transaction(async (tx) => {
    await lockRoomType(tx, roomType.id)
    const taken = await roomsTaken(tx, roomType.id, {
      propertyId: input.propertyId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      ownHoldId: input.holdId,
    })
    if (taken >= roomType.totalRooms) throw new BookingError('Phòng đã hết trong khoảng ngày này', 409)
    // A room chosen at the desk: one of the hotel's listed rooms (put in after
    // the booking exists, with every room check), or a number typed for a type
    // without listed rooms (rooms.ts).
    const typedNumber = input.roomNumber?.trim() ? normalizeRoomNumber(input.roomNumber) : null
    let roomId = input.roomId ?? null
    let roomNumber: string | null = null
    if (!roomId && typedNumber) {
      const listed = await tx.room.findFirst({ where: { propertyId: input.propertyId, number: typedNumber }, select: { id: true } })
      if (listed) roomId = listed.id
      else if ((await tx.room.count({ where: { roomTypeId: roomType.id } })) > 0) {
        throw new BookingError(`Không có phòng ${typedNumber} trong danh sách phòng của khách sạn`, 400)
      } else {
        const inRoom = await typedRoomNumberConflict(tx, { propertyId: input.propertyId, roomNumber: typedNumber, checkIn: input.checkIn, checkOut: input.checkOut })
        if (inRoom) throw new BookingError(roomConflictMessage(typedNumber, inRoom), 409)
        roomNumber = typedNumber
      }
    }
    if (roomId) {
      const room = await tx.room.findFirst({ where: { id: roomId, propertyId: input.propertyId }, select: { roomTypeId: true } })
      if (!room) throw new BookingError('Không tìm thấy phòng', 404)
      if (room.roomTypeId !== roomType.id) throw new BookingError('Phòng đã chọn không thuộc hạng phòng này', 400)
    }

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
            roomNumber,
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
    if (roomId) {
      try {
        await assignRoomTx(tx, { bookingId: booking.id, roomId })
      } catch (error) {
        if (error instanceof RoomError) throw new BookingError(error.message, error.status)
        throw error
      }
    }
    // The guest's hold has done its job.
    if (input.holdId) {
      // Scoped: the id comes from the browser, and must not release another
      // hotel's or another room type's hold.
      await tx.roomLock.deleteMany({
        where: { id: input.holdId, type: 'HOLD', bookingId: null, propertyId: input.propertyId, roomTypeId: roomType.id },
      })
    }
    const emailIds = await queueBookingEmails(tx, booking, input.deposit)
    // The bell in the dashboard, beside the owner's email (src/lib/notifications.ts).
    await notifyNewBooking(tx, booking)
    return { booking, emailIds, quote }
  })
}
