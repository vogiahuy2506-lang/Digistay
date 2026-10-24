/**
 * Which room a stay is in (task 27). A room number is one physical room of
 * the hotel, whatever the room type: no two active stays (PENDING,
 * CONFIRMED, CHECKED_IN) may share it on a night. A check-out day is free
 * for the next check-in.
 */
import type { Prisma } from '@prisma/client'
import { ACTIVE_BOOKING_STATUSES } from './occupancy'

type Tx = Prisma.TransactionClient

export class RoomError extends Error {
  constructor(
    message: string,
    readonly status = 409
  ) {
    super(message)
    this.name = 'RoomError'
  }
}

/** dd/mm/yyyy in Vietnam time. */
const day = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10).split('-').reverse().join('/')

type Taken = { booking: { bookingCode: string; checkInDate: Date; checkOutDate: Date } }

export const roomConflictMessage = (number: string, taken: Taken) =>
  `Phòng ${number} đã có đơn ${taken.booking.bookingCode} (${day(taken.booking.checkInDate)} – ${day(taken.booking.checkOutDate)})`

/**
 * Another active stay of the hotel with this room number on one of these
 * nights, if any. Serialized per number (an advisory lock until the
 * transaction ends), so two people giving out the same room at once cannot
 * both pass.
 */
export async function typedRoomNumberConflict(
  tx: Tx,
  input: { propertyId: string; roomNumber: string; checkIn: Date; checkOut: Date; exceptBookingId?: string }
): Promise<Taken | null> {
  const key = `room:${input.propertyId}:${input.roomNumber.toLowerCase()}`
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`
  return tx.bookingItem.findFirst({
    where: {
      roomNumber: { equals: input.roomNumber, mode: 'insensitive' },
      booking: {
        propertyId: input.propertyId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        checkInDate: { lt: input.checkOut },
        checkOutDate: { gt: input.checkIn },
        ...(input.exceptBookingId && { id: { not: input.exceptBookingId } }),
      },
    },
    select: { booking: { select: { bookingCode: true, checkInDate: true, checkOutDate: true } } },
  })
}
