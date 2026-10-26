/**
 * How many rooms of a type are taken on some dates — one count for the
 * public availability, the guest's hold, every booking and extension. There
 * used to be three, each wrong somewhere:
 *
 * - a booking takes a room of ITS room type (bookings of other types were
 *   counted against this one);
 * - a booking's own lock is not counted again (it was, so a booking made
 *   the next one fail for 30 minutes);
 * - maintenance and manual blocks count, with or without an end date (locks
 *   without expiresAt were ignored: a room under maintenance could be booked);
 * - a guest's hold counts until it expires, except for that guest's own
 *   booking (their hold used to make their own booking fail).
 *
 * Dates overlap when one starts before the other ends: a check-out day is
 * free for the next check-in. A stay split between rooms (rooms.ts) takes
 * each type on its nights in it only: by its segments, not its item.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Db = Prisma.TransactionClient | typeof prisma

export const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN'] as const

interface Span {
  propertyId: string
  checkIn: Date
  checkOut: Date
  now?: Date
  /** a guest's own hold (RoomLock id): not counted against their booking */
  ownHoldId?: string | null
}

function lockWhere({ propertyId, checkIn, checkOut, now = new Date(), ownHoldId }: Span): Prisma.RoomLockWhereInput {
  return {
    propertyId,
    bookingId: null,
    lockStart: { lt: checkOut },
    lockEnd: { gt: checkIn },
    AND: [
      { OR: [{ type: { in: ['MAINTENANCE', 'BLOCKED'] } }, { type: { in: ['HOLD', 'BOOKED'] }, expiresAt: { gt: now } }] },
      // Only a HOLD is ever the guest's own: the id comes from the browser, and
      // excluding any lock by id let a maintenance lock's id free its room.
      ...(ownHoldId ? [{ NOT: { id: ownHoldId, type: 'HOLD' as const } }] : []),
    ],
  }
}

const activeBooking = ({ propertyId }: Span): Prisma.BookingWhereInput => ({ propertyId, status: { in: [...ACTIVE_BOOKING_STATUSES] } })

/** Stays in one room: their item's type, every night. */
function itemWhere(span: Span): Prisma.BookingItemWhereInput {
  return {
    booking: { ...activeBooking(span), checkInDate: { lt: span.checkOut }, checkOutDate: { gt: span.checkIn }, roomSegments: { none: {} } },
  }
}

/** Split stays: the segments on the span's nights, each booking once per type. */
function segmentWhere(span: Span): Prisma.BookingRoomSegmentWhereInput {
  return { fromDate: { lt: span.checkOut }, toDate: { gt: span.checkIn }, booking: activeBooking(span) }
}

/** Rooms of one type taken over the span. */
export async function roomsTaken(db: Db, roomTypeId: string, span: Span) {
  const [booked, split, locked] = await Promise.all([
    db.bookingItem.count({ where: { roomTypeId, ...itemWhere(span) } }),
    db.bookingRoomSegment.findMany({ where: { roomTypeId, ...segmentWhere(span) }, distinct: ['bookingId'], select: { bookingId: true } }),
    db.roomLock.count({ where: { roomTypeId, ...lockWhere(span) } }),
  ])
  return booked + split.length + locked
}

/** Rooms taken over the span, per room type of the property. */
export async function roomsTakenByType(db: Db, span: Span) {
  const [booked, split, locked] = await Promise.all([
    db.bookingItem.groupBy({ by: ['roomTypeId'], where: itemWhere(span), _count: { _all: true } }),
    db.bookingRoomSegment.findMany({ where: segmentWhere(span), distinct: ['bookingId', 'roomTypeId'], select: { roomTypeId: true } }),
    db.roomLock.groupBy({ by: ['roomTypeId'], where: lockWhere(span), _count: { _all: true } }),
  ])
  const taken = new Map<string, number>()
  for (const row of [...booked, ...locked]) taken.set(row.roomTypeId, (taken.get(row.roomTypeId) ?? 0) + row._count._all)
  for (const row of split) taken.set(row.roomTypeId, (taken.get(row.roomTypeId) ?? 0) + 1)
  return taken
}

/**
 * The guest's own hold at a hotel, by their hold session (hold-session.ts;
 * the room-lock route keeps one per session and hotel): its id, to pass as
 * `ownHoldId`. `roomTypeId`: only a hold of that room type.
 */
export async function heldBySession(
  db: Db,
  { propertyId, roomTypeId, sessionId }: { propertyId: string; roomTypeId?: string; sessionId: string | null | undefined },
) {
  if (!sessionId) return null
  const hold = await db.roomLock.findFirst({
    where: { propertyId, sessionId, type: 'HOLD', bookingId: null, ...(roomTypeId && { roomTypeId }) },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return hold?.id ?? null
}

/** Serializes bookings of one room type: two requests for the last room cannot both pass the count. */
export async function lockRoomType(tx: Prisma.TransactionClient, roomTypeId: string) {
  await tx.$queryRaw`SELECT id FROM room_types WHERE id = ${roomTypeId} FOR UPDATE`
}
