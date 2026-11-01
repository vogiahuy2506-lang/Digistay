import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { couponUsability, discountFor, normalizeCouponCode } from '@/lib/marketing/coupons'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

const validateSchema = z.object({
  propertyId: z.string().min(1),
  code: z.string().trim().min(1, 'Vui lòng nhập mã ưu đãi').max(30, 'Mã ưu đãi tối đa 30 ký tự'),
  /** the stay's current total (room + surcharges + services), as the page priced it */
  subtotal: z.coerce.number({ invalid_type_error: 'Dữ liệu không hợp lệ' }).nonnegative('Dữ liệu không hợp lệ'),
})

/**
 * POST /api/public/coupons/validate — a guest checks a discount code while
 * booking on the hotel's site. Public: per-IP limit. Answers whether the code
 * applies to the current subtotal and how much it takes off.
 *
 * Preview only: the booking route (src/lib/bookings/create-booking.ts)
 * re-checks everything under a row lock and never trusts this answer.
 */
export async function POST(request: NextRequest) {
  const byIp = await hit(LIMITS.couponValidateIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn tra mã quá nhiều lần. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
  }

  const parsed = validateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { propertyId, subtotal } = parsed.data
  const code = normalizeCouponCode(parsed.data.code)
  if (!code) {
    return NextResponse.json({ success: false, error: 'Mã ưu đãi chỉ gồm chữ và số' }, { status: 400 })
  }

  // Only a hotel whose site is published answers (an unpublished site is a
  // 404 for guests, src/lib/public-site/visibility.ts).
  const hotel = await prisma.property.findFirst({
    where: { id: propertyId, isActive: true, websiteSettings: { isPublished: true } },
    select: { id: true },
  })
  if (!hotel) return NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

  const coupon = await prisma.coupon.findFirst({
    where: { propertyId, code, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      discountType: true,
      discountValue: true,
      maxDiscount: true,
      minOrderAmount: true,
      startDate: true,
      endDate: true,
      usageLimit: true,
      usageCount: true,
      isActive: true,
    },
  })
  if (!coupon) return NextResponse.json({ success: false, error: 'Mã ưu đãi không đúng, kiểm tra lại giúp bạn nhé' }, { status: 404 })

  const usable = couponUsability(coupon)
  if (!usable.ok) return NextResponse.json({ success: false, error: usable.error }, { status: 400 })

  const priced = discountFor(coupon, subtotal)
  if (!priced.ok) return NextResponse.json({ success: false, error: priced.error }, { status: 400 })

  return NextResponse.json({
    success: true,
    data: {
      coupon: { id: coupon.id, code: coupon.code, name: coupon.name },
      discount: priced.discount,
      subtotal,
      total: Math.max(0, Math.round(subtotal) - priced.discount),
    },
  })
}
