import { prisma } from '@/lib/db'
import { depositUrl } from '@/lib/payments/deposit-link'
import { queueAbandonedCart } from '@/lib/email/outbox'
import type { Locale } from '@/i18n/locales'

export interface ProcessAbandonedResult {
  processed: number
  sent: number
  skipped: number
  errors: number
}

/**
 * Task 48: Quét các đơn đặt phòng bỏ dở (status = PENDING, được tạo từ 2h đến 12h trước, chưa gửi email)
 * và tự động gửi email nhắc nhở kèm liên kết hoàn tất đơn hàng.
 */
export async function processAbandonedBookings(options?: {
  now?: Date
  batchSize?: number
}): Promise<ProcessAbandonedResult> {
  const now = options?.now ?? new Date()
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)
  const batchSize = options?.batchSize ?? 50

  const candidates = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      abandonedEmailSentAt: null,
      createdAt: {
        gte: twelveHoursAgo,
        lte: twoHoursAgo,
      },
      guestEmail: {
        not: '',
        contains: '@',
      },
      payments: {
        none: {
          status: 'PAID',
        },
      },
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          subdomain: true,
          phone: true,
        },
      },
      bookingItems: {
        select: {
          roomTypeId: true,
        },
      },
    },
    take: batchSize,
    orderBy: { createdAt: 'asc' },
  })

  // Batch-fetch room type names for all candidates
  const roomTypeIds = Array.from(
    new Set(
      candidates
        .map((c) => c.bookingItems[0]?.roomTypeId)
        .filter((id): id is string => Boolean(id))
    )
  )

  const roomTypes =
    roomTypeIds.length > 0
      ? await prisma.roomType.findMany({
          where: { id: { in: roomTypeIds } },
          select: { id: true, name: true },
        })
      : []

  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]))

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const booking of candidates) {
    if (!booking.guestEmail || !booking.property) {
      skipped++
      continue
    }

    try {
      // Atomic check and claim (idempotent: prevent concurrent duplicate sends)
      const updated = await prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: 'PENDING',
          abandonedEmailSentAt: null,
        },
        data: {
          abandonedEmailSentAt: now,
        },
      })

      if (updated.count === 0) {
        skipped++
        continue
      }

      const locale = (booking.locale === 'en' ? 'en' : 'vi') as Locale
      const roomTypeId = booking.bookingItems[0]?.roomTypeId
      const roomName = (roomTypeId ? roomTypeMap.get(roomTypeId) : undefined) || 'Phòng nghỉ'
      const continueUrl = depositUrl(booking.property.subdomain, booking.id, locale)

      await queueAbandonedCart(
        {
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          hotelName: booking.property.name,
          hotelPhone: booking.property.phone,
          roomName,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          totalAmount: booking.totalAmount,
          continueUrl,
          locale,
        },
        booking.id
      )

      sent++
    } catch (err) {
      console.error(`[abandoned-cart] Failed to process booking ${booking.id}:`, err)
      errors++
    }
  }

  return {
    processed: candidates.length,
    sent,
    skipped,
    errors,
  }
}
