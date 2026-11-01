import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

const leadSchema = z.object({
  propertyId: z.string().min(1, 'Thiếu propertyId'),
  email: z.string().trim().max(200, 'Email quá dài').email('Email chưa đúng định dạng'),
})

/**
 * POST /api/public/leads — a visitor leaves an email in the exit-intent
 * popup (task 43) or a contact form (task 44). Public; per-IP limit.
 * Only hotels with a published site accept leads (unpublished is a 404
 * for guests, src/lib/public-site/visibility.ts).
 */
export async function POST(request: NextRequest) {
  const byIp = await hit(LIMITS.leadCaptureIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn gửi quá nhiều lần. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
  }

  const parsed = leadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { propertyId, email } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const hotel = await prisma.property.findFirst({
    where: { id: propertyId, isActive: true, deletedAt: null, websiteSettings: { isPublished: true } },
    select: {
      id: true,
      websiteSettings: { select: { exitIntentEnabled: true, exitIntentCouponId: true } },
    },
  })
  if (!hotel) return NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

  const couponId = hotel.websiteSettings?.exitIntentCouponId ?? null
  let coupon: {
    id: string
    code: string
    name: string
    discountType: 'PERCENT' | 'FIXED_AMOUNT'
    discountValue: number
    maxDiscount: number | null
    minOrderAmount: number | null
  } | null = null
  if (couponId) {
    const now = new Date()
    const found = await prisma.coupon.findFirst({
      where: {
        id: couponId,
        propertyId,
        isActive: true,
        deletedAt: null,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        code: true,
        name: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
        minOrderAmount: true,
        usageLimit: true,
        usageCount: true,
      },
    })
    if (found && (found.usageLimit == null || found.usageCount < found.usageLimit)) {
      coupon = {
        id: found.id,
        code: found.code,
        name: found.name,
        discountType: found.discountType,
        discountValue: found.discountValue,
        maxDiscount: found.maxDiscount,
        minOrderAmount: found.minOrderAmount,
      }
    }
  }

  const page = request.headers.get('referer')?.slice(0, 500) ?? null
  const existing = await prisma.lead.findFirst({
    where: { propertyId, email: normalizedEmail },
    select: { id: true },
  })
  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        data: {
          source: 'EXIT_POPUP',
          metadata: { ...(page ? { page } : {}), ...(coupon ? { couponCode: coupon.code } : {}) },
        },
        select: { id: true, email: true },
      })
    : await prisma.lead.create({
        data: {
          propertyId,
          email: normalizedEmail,
          source: 'EXIT_POPUP',
          metadata: { ...(page ? { page } : {}), ...(coupon ? { couponCode: coupon.code } : {}) },
        },
        select: { id: true, email: true },
      })

  return NextResponse.json({
    success: true,
    data: { lead, coupon },
  })
}
