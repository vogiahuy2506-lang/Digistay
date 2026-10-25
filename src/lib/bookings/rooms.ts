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
 *   while under maintenance. Assigning locks the booking, then (when the
 *   inventory moves) the room type, then the room's row, so two people
 *   moving guests at once cannot both take it.
 * - Moving a stay to a room of another type moves its inventory too, only if
 *   that type has a room free every night; the price stays as booked.
 * - A stay can change rooms part way (room-plan.ts): "from the night of D,
 *   room R". Every rule above holds night by night, for the nights moved
 *   only. Only nights strictly inside the stay split it, and nights before
 *   today (Vietnam) never move: the guest slept there. A whole-stay move
 *   puts every night in one room again, as before.
 * - An extension keeps the guest in their last night's room: it must be
 *   free and open on the extra nights too.
 * - Fewer rooms (a room deactivated or deleted) must still hold every future
 *   night already sold.
 * - A room number is one room of the hotel, whatever the type and the case:
 *   typed numbers (types without listed rooms) are checked against every
 *   active stay too, under an advisory lock per number.
 */
import type { Prisma } from '@prisma/client'
import { lockBooking } from '@/lib/payments/booking-payments'
import { ACTIVE_BOOKING_STATUSES, lockRoomType, roomsTaken } from './occupancy'
import { isDay, nightStart, nightsOutsideType, planNumbers, roomPlan, spansWithin, vnDay, withNightsIn, type RoomSpan } from './room-plan'

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
  return stayInRoom(tx, { roomNumber: { equals: input.roomNumber, mode: 'insensitive' } }, input)
}

/**
 * The first active stay of the hotel holding a room (`room` matches the
 * booking item or segment) on a night of the span: a stay in one room by its
 * item, a split stay by the segment of those nights (its dates in the message).
 */
async function stayInRoom(
  tx: Tx,
  room: Prisma.BookingItemWhereInput & Prisma.BookingRoomSegmentWhereInput,
  span: { propertyId: string; checkIn: Date; checkOut: Date; exceptBookingId?: string }
): Promise<Taken | null> {
  const booking = {
    propertyId: span.propertyId,
    status: { in: [...ACTIVE_BOOKING_STATUSES] },
    ...(span.exceptBookingId && { id: { not: span.exceptBookingId } }),
  }
  const [whole, part] = await Promise.all([
    tx.bookingItem.findFirst({
      where: { ...room, booking: { ...booking, checkInDate: { lt: span.checkOut }, checkOutDate: { gt: span.checkIn }, roomSegments: { none: {} } } },
      select: { booking: { select: { bookingCode: true, checkInDate: true, checkOutDate: true } } },
    }),
    tx.bookingRoomSegment.findFirst({
      where: { ...room, fromDate: { lt: span.checkOut }, toDate: { gt: span.checkIn }, booking },
      select: { fromDate: true, toDate: true, booking: { select: { bookingCode: true } } },
    }),
  ])
  if (whole) return whole
  return part && { booking: { bookingCode: part.booking.bookingCode, checkInDate: part.fromDate, checkOutDate: part.toDate } }
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
  const [items, segments, locks] = await Promise.all([
    tx.bookingItem.findMany({
      where: { roomTypeId, booking: { status: { in: [...ACTIVE_BOOKING_STATUSES] }, checkOutDate: { gt: from }, roomSegments: { none: {} } } },
      select: { booking: { select: { checkInDate: true, checkOutDate: true } } },
    }),
    // A split stay takes the type on its nights in it only.
    tx.bookingRoomSegment.findMany({
      where: { roomTypeId, toDate: { gt: from }, booking: { status: { in: [...ACTIVE_BOOKING_STATUSES] } } },
      select: { fromDate: true, toDate: true },
    }),
    tx.roomLock.findMany({
      where: { roomTypeId, bookingId: null, type: { in: ['MAINTENANCE', 'BLOCKED'] }, lockEnd: { gt: from } },
      select: { lockStart: true, lockEnd: true },
    }),
  ])
  const edges: [number, number][] = []
  for (const { booking } of items) edges.push([Math.max(booking.checkInDate.getTime(), from.getTime()), 1], [booking.checkOutDate.getTime(), -1])
  for (const part of segments) edges.push([Math.max(part.fromDate.getTime(), from.getTime()), 1], [part.toDate.getTime(), -1])
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
export function roomTakenBy(
  tx: Tx,
  room: { id: string; number: string; propertyId: string },
  span: { checkIn: Date; checkOut: Date; exceptBookingId?: string }
) {
  // A stay typed in by number before the hotel listed its rooms counts too.
  return stayInRoom(tx, { OR: [{ roomId: room.id }, { roomId: null, roomNumber: { equals: room.number, mode: 'insensitive' } }] }, { ...span, propertyId: room.propertyId })
}

export function roomUnderMaintenance(tx: Tx, roomId: string, span: { checkIn: Date; checkOut: Date }) {
  return tx.roomLock.findFirst({
    where: { roomId, type: { in: ['MAINTENANCE', 'BLOCKED'] }, lockStart: { lt: span.checkOut }, lockEnd: { gt: span.checkIn } },
    select: { lockStart: true, lockEnd: true },
  })
}

/**
 * The nights a move takes: the whole stay, or [fromDate, toDate) of it
 * (yyyy-mm-dd, Vietnam days; toDate defaults to check-out). A part must split
 * the stay strictly inside it and hold no night before today.
 */
function nightsToMove(
  booking: { checkInDate: Date; checkOutDate: Date },
  input: { fromDate?: string; toDate?: string; now?: Date }
): { from: Date; to: Date; whole: boolean } {
  if (input.fromDate === undefined && input.toDate === undefined) return { from: booking.checkInDate, to: booking.checkOutDate, whole: true }
  const first = vnDay(booking.checkInDate)
  const end = vnDay(booking.checkOutDate)
  const from = input.fromDate ?? first
  const to = input.toDate ?? end
  if (!isDay(from) || !isDay(to)) throw new RoomError('Ngày đổi phòng không hợp lệ', 400)
  if (!(first <= from && from < to && to <= end) || (from === first && to === end)) {
    throw new RoomError(`Ngày đổi phòng phải sau ngày nhận và trước ngày trả phòng (${day(booking.checkInDate)} – ${day(booking.checkOutDate)})`, 400)
  }
  if (from < vnDay(input.now ?? new Date())) throw new RoomError('Không đổi phòng được cho những đêm đã qua')
  return { from: nightStart(booking.checkInDate, from), to: to === end ? booking.checkOutDate : nightStart(booking.checkInDate, to), whole: false }
}

/**
 * Writes the stay's new plan: one room → no segments; split → its segments.
 * The booking item keeps the first night's room and type either way.
 */
async function savePlan(tx: Tx, bookingId: string, itemId: string, plan: RoomSpan[]) {
  await tx.bookingRoomSegment.deleteMany({ where: { bookingId } })
  if (plan.length > 1) {
    await tx.bookingRoomSegment.createMany({
      data: plan.map((s) => ({ bookingId, roomId: s.roomId, roomNumber: s.roomNumber ?? '', roomTypeId: s.roomTypeId, fromDate: s.from, toDate: s.to })),
    })
  }
  const [first] = plan
  await tx.bookingItem.update({ where: { id: itemId }, data: { roomId: first.roomId, roomNumber: first.roomNumber, roomTypeId: first.roomTypeId } })
}

/**
 * Puts one booking's stay in a room (or takes it out: roomId null), inside
 * the caller's transaction: the whole stay, or from the night of `fromDate`
 * (to `toDate`, default check-out) for a mid-stay room change. Checks the
 * room is the hotel's, active, free and not under maintenance on every night
 * moved; nights that come from another type move its inventory there if that
 * type has a room free on them.
 */
export async function assignRoomTx(
  tx: Tx,
  input: { bookingId: string; roomId: string | null; fromDate?: string; toDate?: string; now?: Date }
): Promise<{ from: string | null; to: string | null; roomTypeChanged: boolean; split: boolean }> {
  await lockBooking(tx, input.bookingId)
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: input.bookingId },
    select: {
      id: true,
      propertyId: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      bookingItems: { take: 1, select: { id: true, roomId: true, roomTypeId: true, roomNumber: true } },
      roomSegments: { select: { roomId: true, roomNumber: true, roomTypeId: true, fromDate: true, toDate: true } },
    },
  })
  const item = booking.bookingItems[0]
  if (!item) throw new RoomError('Đơn đặt phòng không có hạng phòng', 400)
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) {
    throw new RoomError('Chỉ xếp phòng cho đơn đang chờ, đã xác nhận hoặc đang ở')
  }
  const plan = roomPlan(booking)
  const nights = nightsToMove(booking, input)
  if (!nights.whole && input.roomId === null) throw new RoomError('Chỉ bỏ xếp phòng được cho cả kỳ lưu trú', 400)
  if (!nights.whole && plan.every((s) => !s.roomNumber)) throw new RoomError('Xếp phòng cho đơn trước khi đổi phòng từ một ngày')
  const before = planNumbers(spansWithin(plan, nights.from, nights.to)) || null

  if (input.roomId === null) {
    await tx.bookingRoomSegment.deleteMany({ where: { bookingId: booking.id } })
    await tx.bookingItem.update({ where: { id: item.id }, data: { roomId: null, roomNumber: null } })
    return { from: before, to: null, roomTypeChanged: false, split: false }
  }

  const room = await tx.room.findFirst({
    where: { id: input.roomId, propertyId: booking.propertyId },
    select: { id: true, number: true, propertyId: true, roomTypeId: true, isActive: true },
  })
  if (!room) throw new RoomError('Không tìm thấy phòng', 404)
  if (!room.isActive) throw new RoomError(`Phòng ${room.number} đang ngừng sử dụng`)

  // Nights coming from another type move its inventory: that type is locked
  // before the room, the order bookings take (create-booking.ts), so the two
  // never wait on each other.
  const leaving = nightsOutsideType(plan, nights.from, nights.to, room.roomTypeId)
  if (leaving.length) await lockRoomType(tx, room.roomTypeId)
  await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${room.id} FOR UPDATE`
  await lockRoomNumber(tx, room.propertyId, room.number)

  const span = { checkIn: nights.from, checkOut: nights.to, exceptBookingId: booking.id }
  const taken = await roomTakenBy(tx, room, span)
  if (taken) throw new RoomError(roomConflictMessage(room.number, taken))
  const closed = await roomUnderMaintenance(tx, room.id, span)
  if (closed) throw new RoomError(`Phòng ${room.number} đang bảo trì (${day(closed.lockStart)} – ${day(closed.lockEnd)})`)

  if (leaving.length) {
    // Those nights leave their type for this one: it needs a room free on
    // each (the stay's own nights there are others, so never counted).
    const type = await tx.roomType.findUniqueOrThrow({ where: { id: room.roomTypeId }, select: { name: true, totalRooms: true } })
    for (const run of leaving) {
      const used = await roomsTaken(tx, room.roomTypeId, { propertyId: booking.propertyId, checkIn: run.from, checkOut: run.to })
      if (used >= type.totalRooms) throw new RoomError(`Hạng ${type.name} đã kín trong những ngày này`)
    }
  }

  const next = withNightsIn(plan, nights.from, nights.to, { roomId: room.id, roomNumber: room.number, roomTypeId: room.roomTypeId })
  await savePlan(tx, booking.id, item.id, next)
  return { from: before, to: room.number, roomTypeChanged: leaving.length > 0, split: next.length > 1 }
}

/**
 * An extension keeps the guest in their last night's room, inside the
 * caller's transaction (the booking already locked): that type needs a room
 * free on the extra nights, the room itself must be free and open on them,
 * and a split stay's last part grows to the new check-out.
 */
export async function extendRoomTx(tx: Tx, input: { bookingId: string; newCheckOut: Date }) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: input.bookingId },
    select: {
      id: true,
      propertyId: true,
      checkInDate: true,
      checkOutDate: true,
      bookingItems: { take: 1, select: { roomId: true, roomTypeId: true, roomNumber: true } },
      roomSegments: { select: { id: true, roomId: true, roomNumber: true, roomTypeId: true, fromDate: true, toDate: true } },
    },
  })
  const plan = roomPlan(booking)
  const last = plan[plan.length - 1]
  if (!last) throw new RoomError('Không tìm thấy thông tin hạng phòng', 400)
  const span = { checkIn: booking.checkOutDate, checkOut: input.newCheckOut, exceptBookingId: booking.id }

  await lockRoomType(tx, last.roomTypeId)
  const type = await tx.roomType.findUniqueOrThrow({ where: { id: last.roomTypeId }, select: { totalRooms: true } })
  const used = await roomsTaken(tx, last.roomTypeId, { propertyId: booking.propertyId, checkIn: span.checkIn, checkOut: span.checkOut })
  if (used >= type.totalRooms) throw new RoomError('Phòng đã kín trong những đêm gia hạn')

  if (last.roomId) {
    const room = await tx.room.findUnique({ where: { id: last.roomId }, select: { id: true, number: true, propertyId: true } })
    if (room) {
      await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${room.id} FOR UPDATE`
      await lockRoomNumber(tx, room.propertyId, room.number)
      const taken = await roomTakenBy(tx, room, span)
      if (taken) throw new RoomError(roomConflictMessage(room.number, taken))
      const closed = await roomUnderMaintenance(tx, room.id, span)
      if (closed) throw new RoomError(`Phòng ${room.number} đang bảo trì (${day(closed.lockStart)} – ${day(closed.lockEnd)})`)
    }
  } else if (last.roomNumber) {
    const taken = await typedRoomNumberConflict(tx, { propertyId: booking.propertyId, roomNumber: last.roomNumber, ...span })
    if (taken) throw new RoomError(roomConflictMessage(last.roomNumber, taken))
  }

  const lastPart = booking.roomSegments.find((s) => s.toDate.getTime() === booking.checkOutDate.getTime())
  if (lastPart) await tx.bookingRoomSegment.update({ where: { id: lastPart.id }, data: { toDate: input.newCheckOut } })
}
