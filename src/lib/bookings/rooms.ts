/**
 * A hotel's own rooms (task 25 / 27): the numbered rooms of each room type,
 * which bookings are put in, the room timeline draws, and maintenance can
 * close one at a time.
 *
 * - Inventory stays counted per room type (occupancy.ts): once a type has
 *   rooms, RoomType.totalRooms is the number of its active rooms, kept in
 *   step by the room handlers, so the hotel's site and every count still
 *   read one number.
 *   A type without rooms works as before (a count, and a typed room number).
 * - A room is never in two active stays that share a night, nor in a stay
 *   while under maintenance. Assigning locks the booking, then the room's
 *   row, so two people moving guests at once cannot both take it.
 * - Moving a stay to a room of another type moves its inventory too, only if
 *   that type has a room free every night; the price stays as booked.
 * - Fewer rooms (a room deactivated or deleted) must still hold every future
 *   night already sold.
 * - A room number is one room of the hotel, whatever the type and the case:
 *   typed numbers (types without listed rooms) are checked against every
 *   active stay too, under an advisory lock per number.
 */
import type { Prisma } from '@prisma/client'
import { lockBooking } from '@/lib/payments/booking-payments'
import { ACTIVE_BOOKING_STATUSES, lockRoomType, roomsTaken } from './occupancy'

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

/** How room numbers are kept: trimmed, upper case ("a101" and "A101" are one room). */
export const normalizeRoomNumber = (value: string) => value.trim().toUpperCase()

/** Until the transaction ends, nobody else gives out this room number. */
async function lockRoomNumber(tx: Tx, propertyId: string, number: string) {
  const key = `room:${propertyId}:${number.toLowerCase()}`
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`
}

/**
 * Another active stay of the hotel with this room number on one of these
 * nights, if any. Serialized per number, so two people giving out the same
 * room at once cannot both pass.
 */
export async function typedRoomNumberConflict(
  tx: Tx,
  input: { propertyId: string; roomNumber: string; checkIn: Date; checkOut: Date; exceptBookingId?: string }
): Promise<Taken | null> {
  await lockRoomNumber(tx, input.propertyId, input.roomNumber)
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

/** "101-105, 201, 202" → ["101", ..., "105", "201", "202"]; null when unreadable or over `max`. */
export function parseRoomNumbers(input: string, max = 200): string[] | null {
  const out: string[] = []
  for (const part of input.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^([A-Za-z]*)(\d+)\s*-\s*\1?(\d+)$/)
    if (range) {
      const [, prefix, from, to] = range
      const a = Number(from)
      const b = Number(to)
      if (b < a || b - a >= max) return null
      for (let n = a; n <= b; n++) out.push(normalizeRoomNumber(`${prefix}${String(n).padStart(from.length, '0')}`))
    } else if (/^[\p{L}\p{N}][\p{L}\p{N} .\-/]{0,19}$/u.test(part)) {
      out.push(normalizeRoomNumber(part))
    } else {
      return null
    }
    if (out.length > max) return null
  }
  return out.length ? [...new Set(out)] : null
}

/**
 * The type's rooms, all and active. Once it has any, its inventory
 * (RoomType.totalRooms) is the active count; the handler writes it, with
 * the hotel site's cache (public-site-cache.test.ts).
 */
export async function countRooms(tx: Tx, roomTypeId: string) {
  const [all, active] = await Promise.all([
    tx.room.count({ where: { roomTypeId } }),
    tx.room.count({ where: { roomTypeId, isActive: true } }),
  ])
  return { all, active }
}

/**
 * The most rooms of a type sold or closed on any night from `from` on:
 * bookings of the type and its maintenance / blocks. Fewer rooms than this
 * would oversell a night already sold.
 */
export async function peakTaken(tx: Tx, roomTypeId: string, from: Date): Promise<number> {
  const [items, locks] = await Promise.all([
    tx.bookingItem.findMany({
      where: { roomTypeId, booking: { status: { in: [...ACTIVE_BOOKING_STATUSES] }, checkOutDate: { gt: from } } },
      select: { booking: { select: { checkInDate: true, checkOutDate: true } } },
    }),
    tx.roomLock.findMany({
      where: { roomTypeId, bookingId: null, type: { in: ['MAINTENANCE', 'BLOCKED'] }, lockEnd: { gt: from } },
      select: { lockStart: true, lockEnd: true },
    }),
  ])
  const edges: [number, number][] = []
  for (const { booking } of items) edges.push([Math.max(booking.checkInDate.getTime(), from.getTime()), 1], [booking.checkOutDate.getTime(), -1])
  for (const lock of locks) edges.push([Math.max(lock.lockStart.getTime(), from.getTime()), 1], [lock.lockEnd.getTime(), -1])
  // Ends before starts at the same instant: a check-out day is free for the next check-in.
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let now = 0
  let peak = 0
  for (const [, delta] of edges) {
    now += delta
    peak = Math.max(peak, now)
  }
  return peak
}

/** Another active stay in this room on one of these nights, if any. */
export async function roomTakenBy(
  tx: Tx,
  room: { id: string; number: string; propertyId: string },
  span: { checkIn: Date; checkOut: Date; exceptBookingId?: string }
) {
  return tx.bookingItem.findFirst({
    where: {
      // A stay typed in by number before the hotel listed its rooms counts too.
      OR: [{ roomId: room.id }, { roomId: null, roomNumber: { equals: room.number, mode: 'insensitive' } }],
      booking: {
        propertyId: room.propertyId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        checkInDate: { lt: span.checkOut },
        checkOutDate: { gt: span.checkIn },
        ...(span.exceptBookingId && { id: { not: span.exceptBookingId } }),
      },
    },
    select: { booking: { select: { bookingCode: true, checkInDate: true, checkOutDate: true } } },
  })
}

export function roomUnderMaintenance(tx: Tx, roomId: string, span: { checkIn: Date; checkOut: Date }) {
  return tx.roomLock.findFirst({
    where: { roomId, type: { in: ['MAINTENANCE', 'BLOCKED'] }, lockStart: { lt: span.checkOut }, lockEnd: { gt: span.checkIn } },
    select: { lockStart: true, lockEnd: true },
  })
}

/**
 * Puts one booking's stay in a room (or takes it out: roomId null), inside
 * the caller's transaction. Checks the room is the hotel's, active, free
 * every night and not under maintenance; a room of another type moves the
 * stay's inventory there if that type has a room free.
 */
export async function assignRoomTx(
  tx: Tx,
  input: { bookingId: string; roomId: string | null }
): Promise<{ from: string | null; to: string | null; roomTypeChanged: boolean }> {
  await lockBooking(tx, input.bookingId)
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: input.bookingId },
    select: {
      id: true,
      propertyId: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      bookingItems: { take: 1, select: { id: true, roomTypeId: true, roomNumber: true } },
    },
  })
  const item = booking.bookingItems[0]
  if (!item) throw new RoomError('Đơn đặt phòng không có hạng phòng', 400)
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) {
    throw new RoomError('Chỉ xếp phòng cho đơn đang chờ, đã xác nhận hoặc đang ở')
  }

  if (input.roomId === null) {
    await tx.bookingItem.update({ where: { id: item.id }, data: { roomId: null, roomNumber: null } })
    return { from: item.roomNumber, to: null, roomTypeChanged: false }
  }

  const room = await tx.room.findFirst({
    where: { id: input.roomId, propertyId: booking.propertyId },
    select: { id: true, number: true, propertyId: true, roomTypeId: true, isActive: true, roomType: { select: { name: true, totalRooms: true } } },
  })
  if (!room) throw new RoomError('Không tìm thấy phòng', 404)
  if (!room.isActive) throw new RoomError(`Phòng ${room.number} đang ngừng sử dụng`)
  await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${room.id} FOR UPDATE`
  await lockRoomNumber(tx, room.propertyId, room.number)

  const span = { checkIn: booking.checkInDate, checkOut: booking.checkOutDate, exceptBookingId: booking.id }
  const taken = await roomTakenBy(tx, room, span)
  if (taken) throw new RoomError(roomConflictMessage(room.number, taken))
  const closed = await roomUnderMaintenance(tx, room.id, span)
  if (closed) throw new RoomError(`Phòng ${room.number} đang bảo trì (${day(closed.lockStart)} – ${day(closed.lockEnd)})`)

  const roomTypeChanged = room.roomTypeId !== item.roomTypeId
  if (roomTypeChanged) {
    // The stay leaves its type for this one: this type needs a room free every night.
    await lockRoomType(tx, room.roomTypeId)
    const used = await roomsTaken(tx, room.roomTypeId, { propertyId: booking.propertyId, checkIn: booking.checkInDate, checkOut: booking.checkOutDate })
    if (used >= room.roomType.totalRooms) throw new RoomError(`Hạng ${room.roomType.name} đã kín trong những ngày này`)
  }

  await tx.bookingItem.update({
    where: { id: item.id },
    data: { roomId: room.id, roomNumber: room.number, ...(roomTypeChanged && { roomTypeId: room.roomTypeId }) },
  })
  return { from: item.roomNumber, to: room.number, roomTypeChanged }
}
