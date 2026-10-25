import { prisma } from '@/lib/db'

/** What screens read of a split stay's rooms (room-plan.ts), in night order. */
export const ROOM_SEGMENT_SELECT = { roomId: true, roomNumber: true, roomTypeId: true, fromDate: true, toDate: true } as const

type Typed = { roomTypeId: string }
type Named<T> = T & { roomTypeName: string | null }

/**
 * BookingItem stores only `roomTypeId` (no relation), so screens that show
 * "Deluxe Hướng Biển · 203" need the names looked up. One query for any number
 * of bookings; unknown or deleted room types get `null`. A split stay's
 * segments (rooms.ts) get their type's name too.
 */
export async function withRoomTypeNames<T extends { bookingItems: Typed[]; roomSegments?: Typed[] }>(
  bookings: T[]
): Promise<
  (T & {
    bookingItems: Named<T['bookingItems'][number]>[]
    roomSegments: Named<NonNullable<T['roomSegments']>[number]>[]
  })[]
> {
  const ids = Array.from(new Set(bookings.flatMap((b) => [...b.bookingItems, ...(b.roomSegments ?? [])].map((i) => i.roomTypeId))))
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const rows = await prisma.roomType.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    for (const row of rows) names.set(row.id, row.name)
  }
  const named = <I extends Typed>(item: I) => ({ ...item, roomTypeName: names.get(item.roomTypeId) ?? null })
  return bookings.map((b) => ({
    ...b,
    bookingItems: b.bookingItems.map(named),
    roomSegments: (b.roomSegments ?? []).map(named),
  }))
}
