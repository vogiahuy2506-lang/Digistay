import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readReviewToken } from '@/lib/reviews/review-token'

/**
 * GET /api/public/reviews/preview?token=[token]
 * Tải thông tin đơn đặt phòng và cơ sở lưu trú dựa trên reviewToken đã ký.
 * Cho phép khách xem thông tin trước khi đánh giá mà không cần đăng nhập.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ success: false, error: 'Thiếu mã đánh giá' }, { status: 400 })
  }

  const bookingId = readReviewToken(token)
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Mã đánh giá không hợp lệ hoặc đã hết hạn' }, { status: 400 })
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            logo: true,
            coverImage: true,
          },
        },
        bookingItems: {
          select: {
            roomTypeId: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            title: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Resolve room type name
    let roomName = ''
    const roomTypeId = booking.bookingItems[0]?.roomTypeId
    if (roomTypeId) {
      const rt = await prisma.roomType.findUnique({
        where: { id: roomTypeId },
        select: { name: true },
      })
      if (rt) roomName = rt.name
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        hotelName: booking.property.name,
        hotelLogo: booking.property.logo,
        hotelCover: booking.property.coverImage,
        roomName,
        guestName: booking.guestName,
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
        alreadyReviewed: Boolean(booking.review),
        existingReview: booking.review,
      },
    })
  } catch (error) {
    console.error('Fetch review preview error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tải thông tin đánh giá' }, { status: 500 })
  }
}
