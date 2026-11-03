import { prisma } from '@/lib/db'
import { ROOM_RATE_INCLUDE, propertyRateDefaults } from '@/lib/pricing/rates'
import { roomsTakenByType } from '@/lib/bookings/occupancy'
import { quoteStay, ratesFrom } from '@/lib/pricing/quote'
import { localized } from '@/lib/i18n/content'

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
    'phòng', 'đặt phòng', 'thuê phòng', 'tìm phòng', 'còn phòng', 'giá phòng',
    'room', 'book', 'booking', 'stay', 'available', 'reservation', 'cuối tuần',
  ]
  const isRoomInquiry = roomInquiryKeywords.some((kw) => q.includes(kw))

  let checkInDate = addDays(referenceDate, 1)
  let checkOutDate = addDays(checkInDate, 1)
  let hasExplicitDates = false

  // 1. "hôm nay", "tối nay", "today", "tonight"
  if (q.includes('hôm nay') || q.includes('tối nay') || q.includes('today') || q.includes('tonight')) {
    checkInDate = referenceDate
    checkOutDate = addDays(referenceDate, 1)
    hasExplicitDates = true
  }
  // 2. "ngày mai", "tomorrow"
  else if (q.includes('ngày mai') || q.includes('mai') || q.includes('tomorrow')) {
    checkInDate = addDays(referenceDate, 1)
    checkOutDate = addDays(referenceDate, 2)
    hasExplicitDates = true
  }
  // 3. "cuối tuần sau", "next weekend"
  else if (q.includes('cuối tuần sau') || q.includes('next weekend')) {
    const dayOfWeek = referenceDate.getDay() // 0 = Sun, 5 = Fri, 6 = Sat
    const daysUntilNextFriday = ((5 - dayOfWeek + 7) % 7 || 7) + 7
    checkInDate = addDays(referenceDate, daysUntilNextFriday)
    checkOutDate = addDays(checkInDate, 2)
    hasExplicitDates = true
  }
  // 4. "cuối tuần này", "cuối tuần", "this weekend", "weekend"
  else if (q.includes('cuối tuần') || q.includes('weekend')) {
    const dayOfWeek = referenceDate.getDay()
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
  }
  // 5. Explicit date range regex: "từ 15/11 đến 17/11" or "15/11 - 17/11" or "15/11"
  else {
    const rangeMatch = q.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\s*(?:đến|-|to)\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/)
    if (rangeMatch) {
      const year = referenceDate.getFullYear()
      const d1 = parseInt(rangeMatch[1], 10)
      const m1 = parseInt(rangeMatch[2], 10) - 1
      const y1 = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : year

      const d2 = parseInt(rangeMatch[4], 10)
      const m2 = parseInt(rangeMatch[5], 10) - 1
      const y2 = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : year

      const parsedIn = new Date(y1, m1, d1)
      const parsedOut = new Date(y2, m2, d2)
      if (!isNaN(parsedIn.getTime()) && !isNaN(parsedOut.getTime()) && parsedOut > parsedIn) {
        checkInDate = parsedIn
        checkOutDate = parsedOut
        hasExplicitDates = true
      }
    } else {
      const singleDateMatch = q.match(/(?:ngày|vào|on)?\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/)
      if (singleDateMatch) {
        const year = referenceDate.getFullYear()
        const d = parseInt(singleDateMatch[1], 10)
        const m = parseInt(singleDateMatch[2], 10) - 1
        const y = singleDateMatch[3] ? parseInt(singleDateMatch[3], 10) : year
        const parsed = new Date(y, m, d)
        if (!isNaN(parsed.getTime())) {
          checkInDate = parsed
          checkOutDate = addDays(parsed, 1)
          hasExplicitDates = true
        }
      }
    }
  }

  // Adults count extraction
  let adults = 2
  const adultsMatch = q.match(/(\d+)\s*(?:người lớn|người|khách|bạn|adults?|guests?|pax)/)
  if (adultsMatch) {
    const count = parseInt(adultsMatch[1], 10)
    if (count > 0 && count <= 20) adults = count
  } else if (q.includes('phòng đơn') || q.includes('1 người') || q.includes('cho mình tôi') || q.includes('single')) {
    adults = 1
  } else if (q.includes('gia đình') || q.includes('family')) {
    adults = 4
  }

  // Children count extraction
  let children = 0
  const childrenMatch = q.match(/(\d+)\s*(?:trẻ em|trẻ nhỏ|em bé|bé|children|kids?)/)
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
): Promise<{ cards: ChatRoomCard[]; totalAvailable: number }> {
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
          property: { select: { planLockedAt: true, subdomain: true } },
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
        select: { subdomain: true },
      }),
    ])

    const subdomain = params.subdomain || property?.subdomain || ''
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
        roomTypeId: rt.id,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: String(params.adults),
        children: String(params.children),
      }).toString()

      // Direct booking URL on the hotel's site
      const bookingUrl = subdomain
        ? `/${subdomain}/dat-phong?${queryParams}`
        : `/search?${queryParams}`

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
      })
    }

    return { cards, totalAvailable }
  } catch (error) {
    console.error('[searchAvailableRoomsForChat error]:', error)
    return { cards: [], totalAvailable: 0 }
  }
}
