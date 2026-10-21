import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { BookingError, createBooking } from '@/lib/bookings/create-booking'
import { sendAfterResponse } from '@/lib/email/outbox'
import { depositToken, depositUrl } from '@/lib/payments/deposit-link'
import { onlineDepositOf, startGuestDeposit, type OnlineDeposit } from '@/lib/payments/guest-deposit'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX_NIGHTS = 30
const MAX_DAYS_AHEAD = 730

const guestBookingSchema = z.object({
  propertyId: z.string().min(1),
  roomTypeId: z.string().min(1),
  guestName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(100),
  guestEmail: z.string().trim().email('Email không hợp lệ').max(200),
  guestPhone: z.string().trim().regex(/^[0-9+().\s-]{8,20}$/, 'Số điện thoại không hợp lệ'),
  guestNote: z.string().trim().max(1000).optional(),
  checkInDate: z.string().regex(DAY, 'Ngày nhận phòng không hợp lệ'),
  checkOutDate: z.string().regex(DAY, 'Ngày trả phòng không hợp lệ'),
  numAdults: z.number().int().min(1).max(20),
  numChildren: z.number().int().min(0).max(20).default(0),
  services: z.array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().min(1).max(20).default(1) })).max(20).optional(),
  /** the hold from /api/bookings/room-lock: released by this booking */
  holdId: z.string().min(1).optional(),
  vatCompany: z.string().trim().max(200).optional(),
  vatTaxCode: z.string().trim().max(20).optional(),
  vatAddress: z.string().trim().max(300).optional(),
  vatEmail: z.string().trim().email('Email nhận hoá đơn không hợp lệ').max(200).optional().or(z.literal('')),
})

/** The signed link token (deposit-link.ts), or null when NEXTAUTH_SECRET is missing. */
function guestToken(bookingId: string): string | null {
  try {
    return depositToken(bookingId)
  } catch {
    return null
  }
}

/** Today in Vietnam, as yyyy-mm-dd. */
const todayVn = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())

/**
 * POST /api/public/bookings — a guest books on the hotel's site. Public:
 * rate-limited per IP and per guest email (each booking emails that
 * address). The booking is PENDING until the hotel confirms it, or until
 * the guest's deposit arrives when the hotel takes one through PayOS
 * (src/lib/payments/guest-deposit.ts): the answer then carries the PayOS
 * link. The guest never records money here. Priced and checked by the same
 * code as staff bookings (src/lib/bookings/create-booking.ts), so the
 * quote the site showed is what is charged.
 */
export async function POST(request: NextRequest) {
  const byIp = await hit(LIMITS.guestBookingIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn đã đặt nhiều phòng trong thời gian ngắn. Vui lòng thử lại sau hoặc gọi khách sạn.', byIp.retryAfterSec)
  }

  const parsed = guestBookingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const data = parsed.data

  const today = todayVn()
  if (data.checkInDate < today) return NextResponse.json({ success: false, error: 'Ngày nhận phòng đã qua' }, { status: 400 })
  const checkIn = new Date(data.checkInDate)
  const checkOut = new Date(data.checkOutDate)
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000)
  if (nights < 1) return NextResponse.json({ success: false, error: 'Ngày trả phòng phải sau ngày nhận phòng' }, { status: 400 })
  if (nights > MAX_NIGHTS) {
    return NextResponse.json({ success: false, error: `Đặt tối đa ${MAX_NIGHTS} đêm mỗi lần; ở lâu hơn vui lòng liên hệ khách sạn` }, { status: 400 })
  }
  if (checkIn.getTime() - new Date(today).getTime() > MAX_DAYS_AHEAD * 86_400_000) {
    return NextResponse.json({ success: false, error: 'Chưa nhận đặt phòng xa đến vậy' }, { status: 400 })
  }

  // Only an active hotel whose site is published (an unpublished site is a 404
  // for guests, src/lib/public-site/visibility.ts), and a room type of it
  // that takes this many guests.
  const roomType = await prisma.roomType.findFirst({
    where: {
      id: data.roomTypeId,
      propertyId: data.propertyId,
      isActive: true,
      property: { isActive: true, websiteSettings: { isPublished: true } },
    },
    select: { maxAdults: true, maxChildren: true, maxOccupancy: true, property: { select: { subdomain: true, policy: { select: { childrenAllowed: true } } } } },
  })
  if (!roomType) return NextResponse.json({ success: false, error: 'Không tìm thấy hạng phòng' }, { status: 404 })
  if (data.numChildren > 0 && roomType.property.policy?.childrenAllowed === false) {
    return NextResponse.json({ success: false, error: 'Khách sạn không nhận trẻ em' }, { status: 400 })
  }
  if (
    data.numAdults > roomType.maxAdults ||
    data.numChildren > roomType.maxChildren ||
    data.numAdults + data.numChildren > roomType.maxOccupancy
  ) {
    return NextResponse.json(
      { success: false, error: `Hạng phòng này nhận tối đa ${roomType.maxAdults} người lớn, ${roomType.maxChildren} trẻ em` },
      { status: 400 }
    )
  }

  const byEmail = await hit(LIMITS.guestBookingEmail, data.guestEmail)
  if (!byEmail.allowed) {
    return tooManyRequests('Email này đã đặt nhiều phòng trong thời gian ngắn. Vui lòng gọi khách sạn.', byEmail.retryAfterSec)
  }

  // The hotel's online deposit, read once: the email links to it, and its link is made below.
  const depositPolicy: OnlineDeposit | null = await onlineDepositOf(data.propertyId).catch(() => null)

  try {
    const { booking, emailIds } = await createBooking({
      propertyId: data.propertyId,
      roomTypeId: data.roomTypeId,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      guestNote: data.guestNote,
      checkIn,
      checkOut,
      numAdults: data.numAdults,
      numChildren: data.numChildren,
      services: data.services,
      holdId: data.holdId,
      deposit: depositPolicy,
      vat: { company: data.vatCompany, taxCode: data.vatTaxCode, address: data.vatAddress, email: data.vatEmail || null },
      createdById: null,
    })
    sendAfterResponse(emailIds)
    await prisma.activityLog.create({
      data: {
        propertyId: data.propertyId,
        action: 'CREATE',
        entityType: 'BOOKING',
        entityId: booking.id,
        metadata: { bookingCode: booking.bookingCode, by: 'guest' },
      },
    })

    // The hotel's deposit, if it takes one. The booking is made: whatever
    // goes wrong here, the guest is told it stands and the hotel will call.
    let deposit: Awaited<ReturnType<typeof startGuestDeposit>> = null
    try {
      if (depositPolicy) {
        // Back from PayOS's own page: the deposit page, which moves on once the webhook marks it paid.
        const returnUrl = depositUrl(roomType.property.subdomain, booking.id)
        deposit = await startGuestDeposit(booking, depositPolicy, returnUrl)
      }
    } catch (error) {
      console.error('Guest deposit error:', error)
    }

    // Only what the guest needs: no internal ids.
    return NextResponse.json({
      success: true,
      data: {
        bookingCode: booking.bookingCode,
        status: booking.status,
        totalAmount: booking.totalAmount,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        deposit: deposit && { amount: deposit.amount, checkoutUrl: deposit.checkoutUrl, expiresAt: deposit.expiresAt },
        // The hotel takes a deposit but the link could not be made: it will call.
        depositUnavailable: Boolean(depositPolicy && !deposit),
        // The guest's own link, as in the booking email (deposit-link.ts): the deposit and confirmation
        // pages. null without a secret to sign it: the booking stands, the page shows its code instead.
        token: guestToken(booking.id),
      },
      message: deposit
        ? 'Đã giữ đặt phòng. Vui lòng thanh toán tiền cọc để khách sạn xác nhận.'
        : 'Đã gửi yêu cầu đặt phòng. Khách sạn sẽ liên hệ xác nhận.',
    })
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Guest booking error:', error)
    return NextResponse.json({ success: false, error: 'Không đặt được phòng, vui lòng thử lại hoặc gọi khách sạn' }, { status: 500 })
  }
}
