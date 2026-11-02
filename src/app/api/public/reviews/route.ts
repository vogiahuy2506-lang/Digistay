import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { readReviewToken } from '@/lib/reviews/review-token'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { invalidatePublicSite } from '@/lib/public-site/site'

const submitReviewSchema = z.object({
  token: z.string().min(1, 'Thiếu mã đánh giá'),
  rating: z.number().int().min(1, 'Đánh giá tối thiểu 1 sao').max(5, 'Đánh giá tối đa 5 sao'),
  title: z.string().trim().max(200, 'Tiêu đề không quá 200 ký tự').optional(),
  comment: z.string().trim().min(2, 'Vui lòng nhập nhận xét của bạn').max(2000, 'Nhận xét không quá 2000 ký tự'),
})

/**
 * POST /api/public/reviews
 * Khách gửi đánh giá sau kỳ nghỉ qua link mã hoá bảo mật trong email.
 * Public endpoint; rate-limited per IP.
 */
export async function POST(request: NextRequest) {
  const byIp = await hit(LIMITS.reviewSubmitIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn gửi quá nhiều lần. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
  }

  const body = await request.json().catch(() => null)
  const parsed = submitReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' }, { status: 400 })
  }

  const { token, rating, title, comment } = parsed.data
  const bookingId = readReviewToken(token)
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Mã đánh giá không hợp lệ hoặc đã hết hạn' }, { status: 400 })
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    if (booking.review) {
      return NextResponse.json({ success: false, error: 'Đơn đặt phòng này đã được đánh giá rồi' }, { status: 400 })
    }

    const review = await prisma.review.create({
      data: {
        propertyId: booking.propertyId,
        bookingId: booking.id,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        rating,
        title: title || null,
        comment,
        isPublished: true,
        reviewToken: token,
        tokenUsedAt: new Date(),
      },
    })

    // Xoá cache trang chủ public site của khách sạn để hiển thị đánh giá mới ngay
    invalidatePublicSite(booking.propertyId)

    return NextResponse.json({
      success: true,
      data: review,
      message: 'Cảm ơn bạn đã gửi đánh giá kỳ nghỉ!',
    })
  } catch (error) {
    console.error('Submit review error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi gửi đánh giá' }, { status: 500 })
  }
}
