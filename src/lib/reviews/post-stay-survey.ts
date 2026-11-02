import { prisma } from '@/lib/db'
import { reviewUrl } from '@/lib/reviews/review-token'
import { queuePostStaySurvey } from '@/lib/email/outbox'
import type { Locale } from '@/i18n/locales'

export interface ProcessPostStayResult {
  processed: number
  sent: number
  skipped: number
  errors: number
}

/**
 * Task 50: Quét các đơn đặt phòng đã kết thúc lưu trú (check-out từ 24h trước đến 7 ngày trước)
 * và tự động gửi email cảm ơn kèm lời mời đánh giá kỳ nghỉ.
 */
export async function processPostStaySurveys(options?: {
  now?: Date
  batchSize?: number
}): Promise<ProcessPostStayResult> {
  const now = options?.now ?? new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const batchSize = options?.batchSize ?? 50

  const candidates = await prisma.booking.findMany({
    where: {
      postStayEmailSentAt: null,
      guestEmail: {
        not: '',
        contains: '@',
      },
      status: { in: ['CHECKED_OUT', 'CONFIRMED', 'CHECKED_IN'] },
      checkOutDate: {
        gte: sevenDaysAgo,
        lte: oneDayAgo,
      },
      review: null,
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
    orderBy: { checkOutDate: 'asc' },
  })

  // Batch-fetch room type names
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
      // Atomic claim chống gửi trùng lặp
      const updated = await prisma.booking.updateMany({
        where: {
          id: booking.id,
          postStayEmailSentAt: null,
        },
        data: {
          postStayEmailSentAt: now,
        },
      })

      if (updated.count === 0) {
        skipped++
        continue
      }

      const locale = (booking.locale === 'en' ? 'en' : 'vi') as Locale
      const roomTypeId = booking.bookingItems[0]?.roomTypeId
      const roomName = (roomTypeId ? roomTypeMap.get(roomTypeId) : undefined) || 'Phòng nghỉ'
      const feedbackUrl = reviewUrl(booking.property.subdomain, booking.id, locale)

      await queuePostStaySurvey(
        {
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          hotelName: booking.property.name,
          hotelPhone: booking.property.phone,
          roomName,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          reviewUrl: feedbackUrl,
          locale,
        },
        booking.id
      )

      sent++
    } catch (err) {
      console.error(`[post-stay-survey] Failed to process booking ${booking.id}:`, err)
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
