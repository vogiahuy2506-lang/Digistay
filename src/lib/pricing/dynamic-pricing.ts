/**
 * AI Dynamic Pricing Engine for Hotel Room Types (Task 54)
 *
 * Analyzes forward occupancy rates, lead times, weekends and Vietnamese holidays
 * to recommend smart rate adjustments (+10% to +25% or -10% to -15%) that maximize RevPAR.
 */

import { prisma } from '@/lib/db'
import { invalidatePublicSite } from '@/lib/public-site/site'
import type { DynamicPricingStatus } from '@prisma/client'

const DAY_MS = 24 * 60 * 60 * 1000
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export interface HolidayInfo {
  nameVi: string
  nameEn: string
  month: number // 1-12
  day: number // 1-31
  /** Lunar or special fixed gregorian dates for 2025-2027 */
  specificDates?: string[] // YYYY-MM-DD
}

/** National Vietnamese Holidays and major festive periods */
export const VIETNAMESE_HOLIDAYS: HolidayInfo[] = [
  { nameVi: 'Tết Dương Lịch', nameEn: "New Year's Day", month: 1, day: 1 },
  {
    nameVi: 'Tết Nguyên Đán',
    nameEn: 'Lunar New Year',
    month: 1,
    day: 29,
    specificDates: [
      // 2025
      '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02',
      // 2026
      '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21',
      // 2027
      '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11',
    ],
  },
  {
    nameVi: 'Giỗ Tổ Hùng Vương',
    nameEn: 'Hung Kings Commemoration',
    month: 4,
    day: 7,
    specificDates: ['2025-04-07', '2026-04-26', '2027-04-16'],
  },
  { nameVi: 'Giải phóng miền Nam (30/4)', nameEn: 'Reunification Day', month: 4, day: 30 },
  { nameVi: 'Quốc tế Lao động (1/5)', nameEn: 'Labor Day', month: 5, day: 1 },
  {
    nameVi: 'Quốc khánh (2/9)',
    nameEn: 'National Day',
    month: 9,
    day: 2,
    specificDates: ['2025-09-01', '2025-09-02', '2025-09-03', '2026-09-01', '2026-09-02', '2026-09-03'],
  },
  { nameVi: 'Giáng sinh', nameEn: 'Christmas', month: 12, day: 24 },
  { nameVi: 'Giáng sinh', nameEn: 'Christmas Day', month: 12, day: 25 },
  { nameVi: 'Đêm giao thừa Dương lịch', nameEn: "New Year's Eve", month: 12, day: 31 },
]

/** Checks if a date falls on or within 1 day of a Vietnamese Holiday */
export function getHolidayForDate(date: Date): HolidayInfo | null {
  const vnTime = new Date(date.getTime() + VN_OFFSET_MS)
  const y = vnTime.getUTCFullYear()
  const m = vnTime.getUTCMonth() + 1
  const d = vnTime.getUTCDate()
  const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  for (const h of VIETNAMESE_HOLIDAYS) {
    if (h.specificDates && h.specificDates.includes(ymd)) {
      return h
    }
    if (h.month === m && h.day === d) {
      return h
    }
  }
  return null
}

/** Check if date is Friday or Saturday night in Vietnam (peak weekend check-in) */
export function isWeekendNight(date: Date): boolean {
  const vnTime = new Date(date.getTime() + VN_OFFSET_MS)
  const day = vnTime.getUTCDay()
  // 5 = Friday, 6 = Saturday
  return day === 5 || day === 6
}

export interface DayOccupancy {
  date: Date
  dateString: string // YYYY-MM-DD
  isWeekend: boolean
  holiday: HolidayInfo | null
  totalRooms: number
  bookedRooms: number
  occupancyRate: number
  leadDays: number
}

export interface PricingRuleRecommendation {
  percentageChange: number
  suggestedPrice: number
  reasoningVi: string
  reasoningEn: string
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
}

/** Pure rule engine to calculate recommended price change */
export function evaluatePricingRule(params: {
  currentPrice: number
  occupancyRate: number
  isWeekend: boolean
  holiday: HolidayInfo | null
  leadDays: number
}): PricingRuleRecommendation {
  const { currentPrice, occupancyRate, isWeekend, holiday, leadDays } = params

  // 1. Critical High Demand: Occupancy >= 80%
  if (occupancyRate >= 0.8) {
    const pct = 0.20
    const suggested = Math.round((currentPrice * (1 + pct)) / 10_000) * 10_000
    const occPct = Math.round(occupancyRate * 100)
    return {
      percentageChange: 20,
      suggestedPrice: suggested,
      reasoningVi: `Tỷ lệ lấp đầy đạt ${occPct}% (gần kín phòng). Đề xuất tăng giá +20% để tối ưu hóa doanh thu bình quân trên mỗi phòng (RevPAR).`,
      reasoningEn: `Occupancy rate is at ${occPct}%. Recommend increasing rates by +20% to maximize RevPAR.`,
      urgency: 'HIGH',
    }
  }

  // 2. Holiday Demand Peak
  if (holiday) {
    const pct = 0.25
    const suggested = Math.round((currentPrice * (1 + pct)) / 10_000) * 10_000
    return {
      percentageChange: 25,
      suggestedPrice: suggested,
      reasoningVi: `Trùng dịp lễ ${holiday.nameVi}, nhu cầu lưu trú tăng đột biến. Đề xuất tăng giá +25% cho ngày này.`,
      reasoningEn: `Falls on ${holiday.nameEn} holiday with surging demand. Recommend a +25% peak rate adjustment.`,
      urgency: 'HIGH',
    }
  }

  // 3. Weekend Surge with Healthy Demand (occupancy >= 40%)
  if (isWeekend && occupancyRate >= 0.4) {
    const pct = 0.15
    const suggested = Math.round((currentPrice * (1 + pct)) / 10_000) * 10_000
    const occPct = Math.round(occupancyRate * 100)
    return {
      percentageChange: 15,
      suggestedPrice: suggested,
      reasoningVi: `Cuối tuần nhu cầu cao với tỷ lệ lấp đầy ${occPct}%. Đề xuất phụ thu tăng giá +15% so với giá thường.`,
      reasoningEn: `Weekend stay with healthy ${occPct}% demand. Recommend +15% rate increase.`,
      urgency: 'MEDIUM',
    }
  }

  // 4. Last-Minute Distress Sale: Low occupancy (< 30%) with short lead time (<= 3 days)
  if (leadDays <= 3 && occupancyRate < 0.3) {
    const pct = -0.15
    const suggested = Math.round((currentPrice * (1 + pct)) / 10_000) * 10_000
    const occPct = Math.round(occupancyRate * 100)
    return {
      percentageChange: -15,
      suggestedPrice: Math.max(suggested, currentPrice * 0.7),
      reasoningVi: `Chỉ còn ${leadDays} ngày nữa nhưng tỷ lệ lấp đầy mới đạt ${occPct}%. Đề xuất giảm giá kích cầu -15% (deal giờ chót) để lấp đầy phòng trống.`,
      reasoningEn: `Only ${leadDays} days left with low ${occPct}% occupancy. Recommend a -15% last-minute deal to fill vacant rooms.`,
      urgency: 'HIGH',
    }
  }

  // 5. Midweek Off-Peak Early Bird: Low occupancy (< 20%) further out (> 7 days)
  if (!isWeekend && leadDays > 7 && occupancyRate < 0.2) {
    const pct = -0.10
    const suggested = Math.round((currentPrice * (1 + pct)) / 10_000) * 10_000
    return {
      percentageChange: -10,
      suggestedPrice: Math.max(suggested, currentPrice * 0.75),
      reasoningVi: `Ngày giữa tuần tỷ lệ lấp đầy thấp. Khuyến nghị áp dụng ưu đãi đặt sớm (Early-bird -10%) để thu hút khách công tác / nghỉ dưỡng dài ngày.`,
      reasoningEn: `Midweek low demand. Recommend -10% early-bird incentive to drive advance bookings.`,
      urgency: 'LOW',
    }
  }

  // 6. Neutral / Stable
  return {
    percentageChange: 0,
    suggestedPrice: currentPrice,
    reasoningVi: `Tỷ lệ lấp đầy ở mức cân bằng (${Math.round(occupancyRate * 100)}%). Giữ nguyên mức giá hiện tại.`,
    reasoningEn: `Demand is balanced (${Math.round(occupancyRate * 100)}%). Maintain current pricing.`,
    urgency: 'LOW',
  }
}

/**
 * Computes forward occupancy and generates AI dynamic pricing suggestions for a property
 */
export async function generateDynamicPricingSuggestions(
  propertyId: string,
  options?: {
    daysAhead?: number
    model?: string
    apiKey?: string
  }
) {
  const daysAhead = Math.min(Math.max(options?.daysAhead ?? 30, 7), 60)
  const now = new Date()
  const todayVn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // 1. Fetch Room Types with pricing and active rooms count
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId, isActive: true },
    include: {
      pricing: { orderBy: { createdAt: 'desc' }, take: 1 },
      rooms: { where: { isActive: true } },
    },
  })

  if (roomTypes.length === 0) {
    return { createdCount: 0, suggestions: [] }
  }

  // 2. Fetch all active bookings in the range
  const endDate = new Date(todayVn.getTime() + daysAhead * DAY_MS)
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkInDate: { lt: endDate },
      checkOutDate: { gt: todayVn },
    },
    include: {
      bookingItems: { select: { roomTypeId: true } },
    },
  })

  const suggestionsToSave: Array<{
    propertyId: string
    roomTypeId: string
    targetDate: Date
    currentPrice: number
    suggestedPrice: number
    percentageChange: number
    reasoningVi: string
    reasoningEn: string
  }> = []

  for (const rt of roomTypes) {
    const priceRow = rt.pricing[0]
    if (!priceRow || priceRow.weekdayPrice <= 0) continue

    const totalRooms = rt.rooms.length > 0 ? rt.rooms.length : rt.totalRooms || 1

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const targetDate = new Date(todayVn.getTime() + dayOffset * DAY_MS)
      const isWeekend = isWeekendNight(targetDate)
      const holiday = getHolidayForDate(targetDate)
      const currentPrice = isWeekend && priceRow.weekendPrice > 0 ? priceRow.weekendPrice : priceRow.weekdayPrice

      // Count bookings overlapping this night for this roomType
      const bookedRooms = bookings.filter((b) => {
        const checkIn = new Date(b.checkInDate).getTime()
        const checkOut = new Date(b.checkOutDate).getTime()
        const targetTime = targetDate.getTime()
        const matchesType = b.bookingItems.length === 0 || b.bookingItems.some((bi) => bi.roomTypeId === rt.id)
        return matchesType && targetTime >= checkIn && targetTime < checkOut
      }).length

      const occupancyRate = Math.min(1.0, bookedRooms / totalRooms)

      const rec = evaluatePricingRule({
        currentPrice,
        occupancyRate,
        isWeekend,
        holiday,
        leadDays: dayOffset,
      })

      // Only generate actionable suggestions (non-zero change)
      if (rec.percentageChange !== 0) {
        suggestionsToSave.push({
          propertyId,
          roomTypeId: rt.id,
          targetDate,
          currentPrice,
          suggestedPrice: rec.suggestedPrice,
          percentageChange: rec.percentageChange,
          reasoningVi: rec.reasoningVi,
          reasoningEn: rec.reasoningEn,
        })
      }
    }
  }

  // 3. Upsert into database
  const created = []
  for (const item of suggestionsToSave) {
    const row = await prisma.dynamicPricingSuggestion.upsert({
      where: {
        propertyId_roomTypeId_targetDate: {
          propertyId: item.propertyId,
          roomTypeId: item.roomTypeId,
          targetDate: item.targetDate,
        },
      },
      update: {
        currentPrice: item.currentPrice,
        suggestedPrice: item.suggestedPrice,
        percentageChange: item.percentageChange,
        reasoningVi: item.reasoningVi,
        reasoningEn: item.reasoningEn,
      },
      create: {
        propertyId: item.propertyId,
        roomTypeId: item.roomTypeId,
        targetDate: item.targetDate,
        currentPrice: item.currentPrice,
        suggestedPrice: item.suggestedPrice,
        percentageChange: item.percentageChange,
        reasoningVi: item.reasoningVi,
        reasoningEn: item.reasoningEn,
        status: 'PENDING',
      },
      include: {
        roomType: { select: { id: true, name: true, slug: true } },
      },
    })
    created.push(row)
  }

  return {
    createdCount: created.length,
    suggestions: created,
  }
}

/**
 * Applies a pricing suggestion to the room type's rate
 */
export async function applyDynamicPricingSuggestion(suggestionId: string, userId?: string) {
  const suggestion = await prisma.dynamicPricingSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      roomType: {
        include: {
          pricing: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })

  if (!suggestion) {
    throw new Error('Không tìm thấy gợi ý định giá')
  }

  const { propertyId, roomTypeId, targetDate, suggestedPrice } = suggestion
  const isWeekend = isWeekendNight(targetDate)
  const currentPricing = suggestion.roomType.pricing[0]

  // Find or create property's PricingConfig
  let pricingConfig = await prisma.pricingConfig.findFirst({
    where: { propertyId, isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!pricingConfig) {
    pricingConfig = await prisma.pricingConfig.create({
      data: {
        propertyId,
        name: 'Tiêu chuẩn',
        weekdayPrice: suggestedPrice,
        weekendPrice: suggestedPrice,
      },
    })
  }

  // Create or update RoomTypePricing
  const newWeekdayPrice = isWeekend
    ? currentPricing?.weekdayPrice ?? suggestedPrice
    : suggestedPrice
  const newWeekendPrice = isWeekend
    ? suggestedPrice
    : currentPricing?.weekendPrice ?? suggestedPrice

  await prisma.roomTypePricing.create({
    data: {
      roomTypeId,
      pricingId: pricingConfig.id,
      weekdayPrice: newWeekdayPrice,
      weekendPrice: newWeekendPrice,
      extraAdultPrice: currentPricing?.extraAdultPrice ?? 0,
      extraChildPrice: currentPricing?.extraChildPrice ?? 0,
    },
  })

  // Mark suggestion as APPLIED
  const updated = await prisma.dynamicPricingSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: 'APPLIED',
      appliedAt: new Date(),
    },
    include: {
      roomType: { select: { id: true, name: true } },
    },
  })

  invalidatePublicSite(propertyId)

  return updated
}

/**
 * Dismisses a pricing suggestion
 */
export async function dismissDynamicPricingSuggestion(suggestionId: string) {
  return prisma.dynamicPricingSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: 'DISMISSED',
    },
  })
}
