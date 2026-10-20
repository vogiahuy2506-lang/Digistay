/**
 * Reading rates from the database (the rules are in quote.ts): a room
 * type's newest price row, and the property's "Bảng giá" surcharges as
 * the default.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { Rates } from './quote'

/** The newest price row of a room type (the one the "Hạng phòng" page edits). */
export const ROOM_RATE_INCLUDE = {
  pricing: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.RoomTypeInclude

/** The property's surcharges ("Bảng giá"): the default for room types without their own. */
export async function propertyRateDefaults(
  db: Prisma.TransactionClient | typeof prisma,
  propertyId: string
): Promise<Partial<Rates> | null> {
  return db.pricingConfig.findFirst({
    where: { propertyId, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { extraAdultPrice: true, extraChildPrice: true },
  })
}

export const NO_PRICE_MESSAGE = 'Hạng phòng này chưa có giá: đặt giá ở trang Hạng phòng trước khi nhận đặt phòng'
