import { prisma } from '@/lib/db'

/**
 * BookingItem stores only `roomTypeId` (no relation), so screens that show
 * "Deluxe Hướng Biển · 203" need the names looked up. One query for any number
 * of bookings; unknown or deleted room types get `null`.
 */
export async function withRoomTypeNames<T extends { bookingItems: { roomTypeId: string }[] }>(
  bookings: T[]
): Promise<(T & { bookingItems: (T['bookingItems'][number] & { roomTypeName: string | null })[] })[]> {
  const ids = Array.from(new Set(bookings.flatMap((b) => b.bookingItems.map((i) => i.roomTypeId))))
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const rows = await prisma.roomType.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    for (const row of rows) names.set(row.id, row.name)
  }
  return bookings.map((b) => ({
    ...b,
    bookingItems: b.bookingItems.map((item) => ({ ...item, roomTypeName: names.get(item.roomTypeId) ?? null })),
  }))
}
