import { prisma } from '@/lib/db'
import { ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { roomsTakenByType } from '@/lib/bookings/occupancy'
import { quoteStay, ratesFrom } from '@/lib/pricing/quote'
import { localized } from '@/lib/i18n/content'
import { isWorkspaceLocked } from '@/lib/billing/guard'

export interface ChatRoomCard {
  id: string
  name: string
  area: number | null
  bedType: string
  maxOccupancy: number
  availableRooms: number
  imageUrl: string | null
  nightlyPrice: number
  totalPrice: number
  numNights: number
  bookingUrl: string
  bookingPath?: string
}

export interface ExtractedStayQuery {
  isRoomInquiry: boolean
  checkIn: string
  checkOut: string
  adults: number
  children: number
  hasExplicitDates: boolean
}

/** Formats a date to YYYY-MM-DD in Asia/Ho_Chi_Minh timezone */
export function formatVnDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
}

/** Adds days to a date */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Extracts stay dates and guest counts from natural Vietnamese & English questions.
 */
export function parseStayDatesFromText(text: string, referenceDate = new Date()): ExtractedStayQuery {
  const q = text.toLowerCase()

  // Detection triggers
  const roomInquiryKeywords = [
    'phòng', 'đặt phòng', 'thuê phòng', 'tìm phòng', 'còn phòng', 'giá phòng', 'hết phòng',
    'trống', 'còn chỗ', 'chỗ ở', 'nghỉ dưỡng', 'check in', 'check-in', 'checkin', 'checkout', 'check out',
    'room', 'book', 'booking', 'stay', 'available', 'reservation', 'cuối tuần', 'weekend',
  ]
  let isRoomInquiry = roomInquiryKeywords.some((kw) => q.includes(kw))

  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth()
  const refDay = referenceDate.getDate()
  const dayOfWeek = referenceDate.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat

  let checkInDate = addDays(referenceDate, 1)
  let checkOutDate = addDays(checkInDate, 1)
  let hasExplicitDates = false

  // Regex Patterns for Explicit Date Ranges (evaluated first to avoid keywords overriding explicit dates)
  // Pattern 1: Explicit 2 dates with months (e.g., "14/11 - 15/11", "từ 14/11 đến 15/11", "14/11/2026 - 15/11/2026")
  const p1 = /(?:^|[\s(\[])(?:từ\s*|ngày\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\s*(?:đến|tới|to|-)\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/
  // Pattern 2: Shared month range (e.g., "14-15/11", "14 - 15/11", "14 đến 15/11", "(14-15/11)")
  const p2 = /(?:^|[\s(\[])(?:từ\s*|ngày\s*)?(\d{1,2})\s*(?:đến|tới|to|-)\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/
  // Pattern 3: Shared month with "tháng" (e.g., "14-15 tháng 11", "14 đến 15 tháng 11")
  const p3 = /(?:^|[\s(\[])(?:từ\s*|ngày\s*)?(\d{1,2})\s*(?:đến|tới|to|-)\s*(\d{1,2})\s*(?:tháng|thg)\s*(\d{1,2})(?:\s*(?:năm)?\s*(\d{4}))?/
  // Pattern 4: Both dates have "tháng" (e.g., "30 tháng 11 đến 2 tháng 12")
  const p4 = /(?:^|[\s(\[])(?:từ\s*|ngày\s*)?(\d{1,2})\s*(?:tháng|thg)\s*(\d{1,2})\s*(?:đến|tới|to|-)\s*(\d{1,2})\s*(?:tháng|thg)\s*(\d{1,2})(?:\s*(?:năm)?\s*(\d{4}))?/

  const m1 = q.match(p1)
  const m2 = q.match(p2)
  const m3 = q.match(p3)
  const m4 = q.match(p4)

  if (m1) {
    const y1 = m1[3] ? parseInt(m1[3], 10) : refYear
    const y2 = m1[6] ? parseInt(m1[6], 10) : (m1[3] ? parseInt(m1[3], 10) : refYear)
    const d1 = parseInt(m1[1], 10)
    const mo1 = parseInt(m1[2], 10) - 1
    const d2 = parseInt(m1[4], 10)
    const mo2 = parseInt(m1[5], 10) - 1

    let parsedIn = new Date(y1, mo1, d1)
    let parsedOut = new Date(y2, mo2, d2)
    if (!m1[3] && parsedIn < new Date(refYear, refMonth, refDay)) {
      parsedIn = new Date(refYear + 1, mo1, d1)
      parsedOut = new Date(refYear + 1, mo2, d2)
    }
    if (!isNaN(parsedIn.getTime()) && !isNaN(parsedOut.getTime())) {
      checkInDate = parsedIn
      checkOutDate = parsedOut > parsedIn ? parsedOut : addDays(parsedIn, 1)
      hasExplicitDates = true
      isRoomInquiry = true
    }
  } else if (m2) {
    const year = m2[4] ? parseInt(m2[4], 10) : refYear
    const mo = parseInt(m2[3], 10) - 1
    const d1 = parseInt(m2[1], 10)
    const d2 = parseInt(m2[2], 10)

    let parsedIn = new Date(year, mo, d1)
    let parsedOut = new Date(year, mo, d2)
    if (!m2[4] && parsedIn < new Date(refYear, refMonth, refDay)) {
      parsedIn = new Date(refYear + 1, mo, d1)
      parsedOut = new Date(refYear + 1, mo, d2)
    }
    if (!isNaN(parsedIn.getTime()) && !isNaN(parsedOut.getTime())) {
      checkInDate = parsedIn
      checkOutDate = parsedOut > parsedIn ? parsedOut : addDays(parsedIn, 1)
      hasExplicitDates = true
      isRoomInquiry = true
    }
  } else if (m3) {
    const year = m3[4] ? parseInt(m3[4], 10) : refYear
    const mo = parseInt(m3[3], 10) - 1
    const d1 = parseInt(m3[1], 10)
    const d2 = parseInt(m3[2], 10)

    let parsedIn = new Date(year, mo, d1)
    let parsedOut = new Date(year, mo, d2)
    if (!m3[4] && parsedIn < new Date(refYear, refMonth, refDay)) {
      parsedIn = new Date(refYear + 1, mo, d1)
      parsedOut = new Date(refYear + 1, mo, d2)
    }
    if (!isNaN(parsedIn.getTime()) && !isNaN(parsedOut.getTime())) {
      checkInDate = parsedIn
      checkOutDate = parsedOut > parsedIn ? parsedOut : addDays(parsedIn, 1)
      hasExplicitDates = true
      isRoomInquiry = true
    }
  } else if (m4) {
    const year = m4[5] ? parseInt(m4[5], 10) : refYear
    const d1 = parseInt(m4[1], 10)
    const mo1 = parseInt(m4[2], 10) - 1
    const d2 = parseInt(m4[3], 10)
    const mo2 = parseInt(m4[4], 10) - 1

    let parsedIn = new Date(year, mo1, d1)
    let parsedOut = new Date(year, mo2, d2)
    if (!m4[5] && parsedIn < new Date(refYear, refMonth, refDay)) {
      parsedIn = new Date(refYear + 1, mo1, d1)
      parsedOut = new Date(refYear + 1, mo2, d2)
    }
    if (!isNaN(parsedIn.getTime()) && !isNaN(parsedOut.getTime())) {
      checkInDate = parsedIn
      checkOutDate = parsedOut > parsedIn ? parsedOut : addDays(parsedIn, 1)
      hasExplicitDates = true
      isRoomInquiry = true
    }
  } else {
    // Single explicit date
    const pSingle1 = /(?:^|[\s(\[])(?:từ\s*|ngày\s*|vào\s*|tối\s*|đêm\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/
    const pSingle2 = /(?:^|[\s(\[])(?:từ\s*|ngày\s*|vào\s*|tối\s*|đêm\s*)?(\d{1,2})\s*(?:tháng|thg)\s*(\d{1,2})(?:\s*(?:năm)?\s*(\d{4}))?/

    const s1 = q.match(pSingle1)
    const s2 = q.match(pSingle2)

    if (s1) {
      const year = s1[3] ? parseInt(s1[3], 10) : refYear
      const d = parseInt(s1[1], 10)
      const mo = parseInt(s1[2], 10) - 1
      let parsed = new Date(year, mo, d)
      if (!s1[3] && parsed < new Date(refYear, refMonth, refDay)) {
        parsed = new Date(refYear + 1, mo, d)
      }
      if (!isNaN(parsed.getTime())) {
        checkInDate = parsed
        checkOutDate = addDays(parsed, 1)
        hasExplicitDates = true
        isRoomInquiry = true
      }
    } else if (s2) {
      const year = s2[3] ? parseInt(s2[3], 10) : refYear
      const d = parseInt(s2[1], 10)
      const mo = parseInt(s2[2], 10) - 1
      let parsed = new Date(year, mo, d)
      if (!s2[3] && parsed < new Date(refYear, refMonth, refDay)) {
        parsed = new Date(refYear + 1, mo, d)
      }
      if (!isNaN(parsed.getTime())) {
        checkInDate = parsed
        checkOutDate = addDays(parsed, 1)
        hasExplicitDates = true
        isRoomInquiry = true
      }
    } else {
      // Relative date phrases
      if (q.includes('cuối tuần sau') || q.includes('next weekend')) {
        const daysUntilNextFriday = ((5 - dayOfWeek + 7) % 7 || 7) + 7
        checkInDate = addDays(referenceDate, daysUntilNextFriday)
        checkOutDate = addDays(checkInDate, 2)
        hasExplicitDates = true
      } else if (
        q.includes('thứ bảy tuần sau') ||
        q.includes('thứ 7 tuần sau') ||
        q.includes('t7 tuần sau') ||
        q.includes('next saturday')
      ) {
        const daysUntilNextSat = ((6 - dayOfWeek + 7) % 7 || 7) + 7
        checkInDate = addDays(referenceDate, daysUntilNextSat)
        checkOutDate = addDays(checkInDate, 1)
        hasExplicitDates = true
      } else if (
        q.includes('thứ sáu tuần sau') ||
        q.includes('thứ 6 tuần sau') ||
        q.includes('t6 tuần sau') ||
        q.includes('next friday')
      ) {
        const daysUntilNextFri = ((5 - dayOfWeek + 7) % 7 || 7) + 7
        checkInDate = addDays(referenceDate, daysUntilNextFri)
        checkOutDate = addDays(checkInDate, 1)
        hasExplicitDates = true
      } else if (
        q.includes('thứ bảy tuần này') ||
        q.includes('thứ 7 tuần này') ||
        q.includes('t7 tuần này') ||
        q.includes('this saturday')
      ) {
        const daysUntilSat = (6 - dayOfWeek + 7) % 7
        checkInDate = addDays(referenceDate, daysUntilSat === 0 ? 0 : daysUntilSat)
        checkOutDate = addDays(checkInDate, 1)
        hasExplicitDates = true
      } else if (
        q.includes('thứ sáu tuần này') ||
        q.includes('thứ 6 tuần này') ||
        q.includes('t6 tuần này') ||
        q.includes('this friday')
      ) {
        const daysUntilFri = (5 - dayOfWeek + 7) % 7
        checkInDate = addDays(referenceDate, daysUntilFri === 0 ? 0 : daysUntilFri)
        checkOutDate = addDays(checkInDate, 1)
        hasExplicitDates = true
      } else if (q.includes('cuối tuần') || q.includes('weekend')) {
        let daysUntilFriday = (5 - dayOfWeek + 7) % 7
        if (dayOfWeek === 5) daysUntilFriday = 0 // Today is Friday
        if (dayOfWeek === 6) daysUntilFriday = -1 // Today is Saturday

        const friday = addDays(referenceDate, daysUntilFriday)
        checkInDate = dayOfWeek === 6 ? referenceDate : friday
        checkOutDate = addDays(friday, 2) // Sunday
        if (checkOutDate <= checkInDate) {
          checkOutDate = addDays(checkInDate, 1)
        }
        hasExplicitDates = true
      } else if (q.includes('ngày mốt') || q.includes('ngày kia') || q.includes('the day after tomorrow')) {
        checkInDate = addDays(referenceDate, 2)
        checkOutDate = addDays(referenceDate, 3)
        hasExplicitDates = true
      } else if (q.includes('ngày mai') || q.includes('mai') || q.includes('tomorrow')) {
        checkInDate = addDays(referenceDate, 1)
        checkOutDate = addDays(referenceDate, 2)
        hasExplicitDates = true
      } else if (q.includes('hôm nay') || q.includes('tối nay') || q.includes('today') || q.includes('tonight')) {
        checkInDate = referenceDate
        checkOutDate = addDays(referenceDate, 1)
        hasExplicitDates = true
      }
    }
  }

  // Adults count extraction
  let adults = 2
  const adultsMatch = q.match(/(\d+)\s*(?:người lớn|ng lớn|nguoi lon|lớn|người|khách|bạn|adults?|guests?|pax)/)
  if (adultsMatch) {
    const count = parseInt(adultsMatch[1], 10)
    if (count > 0 && count <= 20) adults = count
  } else if (
    q.includes('phòng đơn') ||
    q.includes('1 người') ||
    q.includes('một người') ||
    q.includes('cho mình tôi') ||
    q.includes('cho mình') ||
    q.includes('một mình') ||
    q.includes('single')
  ) {
    adults = 1
  } else if (q.includes('gia đình') || q.includes('family')) {
    adults = 4
  }

  // Children count extraction
  let children = 0
  const childrenMatch = q.match(/(\d+)\s*(?:trẻ em|trẻ nhỏ|em bé|bé|nhỏ|trẻ|children|kids?)/)
  if (childrenMatch) {
    const count = parseInt(childrenMatch[1], 10)
    if (count >= 0 && count <= 10) children = count
  }

  return {
    isRoomInquiry,
    checkIn: formatVnDate(checkInDate),
    checkOut: formatVnDate(checkOutDate),
    adults,
    children,
    hasExplicitDates,
  }
}

/**
 * Searches for real-time available rooms for a property given stay query parameters.
 */
export async function searchAvailableRoomsForChat(
  propertyId: string,
  params: {
    checkIn: string
    checkOut: string
    adults: number
    children: number
    locale?: 'vi' | 'en'
    subdomain?: string
  }
): Promise<{ cards: ChatRoomCard[]; totalAvailable: number; isOnlineBookingPaused?: boolean }> {
  try {
    const checkIn = new Date(`${params.checkIn}T00:00:00+07:00`)
    const checkOut = new Date(`${params.checkOut}T00:00:00+07:00`)
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      return { cards: [], totalAvailable: 0 }
    }

    const numGuests = params.adults + params.children
    const lang = params.locale ?? 'vi'

    const [roomTypes, taken, defaults, property] = await Promise.all([
      prisma.roomType.findMany({
        where: {
          propertyId,
          isActive: true,
          property: { isActive: true },
        },
        include: {
          property: { select: { planLockedAt: true, subdomain: true, workspaceId: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          amenities: {
            include: { amenity: true },
            take: 3,
          },
          ...ROOM_RATE_INCLUDE,
        },
      }),
      roomsTakenByType(prisma, { propertyId, checkIn, checkOut }),
      propertyRateDefaults(prisma, propertyId),
      prisma.property.findUnique({
        where: { id: propertyId },
        select: {
          subdomain: true,
          isActive: true,
          planLockedAt: true,
          workspaceId: true,
          websiteSettings: { select: { isPublished: true } },
        },
      }),
    ])

    // Check if hotel exists, is active, or has an overage plan lock
    if (!property || !property.isActive || property.planLockedAt) {
      return { cards: [], totalAvailable: 0, isOnlineBookingPaused: true }
    }

    // Check workspace lock (e.g. trial/subscription expired past grace period)
    const locked = await isWorkspaceLocked(property.workspaceId).catch(() => false)
    if (locked) {
      return { cards: [], totalAvailable: 0, isOnlineBookingPaused: true }
    }

    // If hotel has no active room types with pricing configured
    if (roomTypes.length === 0) {
      return { cards: [], totalAvailable: 0, isOnlineBookingPaused: true }
    }

    const subdomain = params.subdomain || property.subdomain || ''
    const cards: ChatRoomCard[] = []
    let totalAvailable = 0

    for (const rt of roomTypes) {
      const rates = ratesFrom(rt.pricing[0], defaults)
      if (!rates) continue

      const planLocked = !!rt.planLockedAt || !!rt.property.planLockedAt
      const availableRooms = planLocked ? 0 : Math.max(0, rt.totalRooms - (taken.get(rt.id) ?? 0))
      if (availableRooms > 0) totalAvailable += availableRooms

      // Check capacity fit
      const fits = rt.maxOccupancy >= numGuests && rt.maxAdults >= params.adults && rt.maxChildren >= params.children
      if (!fits || availableRooms <= 0) continue

      const quote = quoteStay({
        rates,
        checkIn,
        checkOut,
        numAdults: params.adults,
        numChildren: params.children,
        baseOccupancy: rt.baseOccupancy,
      })

      const queryParams = new URLSearchParams({
        room: rt.id,
        roomTypeId: rt.id,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: String(params.adults),
        children: String(params.children),
      }).toString()

      // Direct booking URL on the hotel's site
      const bookingPath = `/dat-phong?${queryParams}`
      const bookingUrl = subdomain
        ? `/${subdomain}/dat-phong?${queryParams}`
        : `/dat-phong?${queryParams}`

      cards.push({
        id: rt.id,
        name: localized(rt, 'name', lang),
        area: rt.area,
        bedType: rt.bedType,
        maxOccupancy: rt.maxOccupancy,
        availableRooms,
        imageUrl: rt.images[0]?.url || null,
        nightlyPrice: quote.basePrice,
        totalPrice: quote.total,
        numNights: quote.nights,
        bookingUrl,
        bookingPath,
      })
    }

    return { cards, totalAvailable }
  } catch (error) {
    console.error('[searchAvailableRoomsForChat error]:', error)
    return { cards: [], totalAvailable: 0 }
  }
}

