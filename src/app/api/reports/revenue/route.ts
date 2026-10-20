import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const querySchema = z.object({
  propertyId: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)

    const propertyId = searchParams.get('propertyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    // Owner, ADMIN or MANAGER: revenue, and the latest bookings with guest
    // contacts. The sidebar shows this report to those roles only.
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, role: { in: ['ADMIN', 'MANAGER'] } } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    // Default date range: last 30 days
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get bookings in date range
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        payments: {
          where: { status: 'PAID' },
        },
      },
    })

    // Get room types for stats
    const roomTypes = await prisma.roomType.findMany({
      where: { propertyId },
      select: {
        totalRooms: true,
      },
    })

    const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)

    // Calculate metrics
    let totalRevenue = 0
    let cashRevenue = 0
    let bankRevenue = 0
    let qrRevenue = 0
    let cardRevenue = 0

    bookings.forEach(booking => {
      totalRevenue += booking.totalAmount
      booking.payments.forEach(payment => {
        switch (payment.method) {
          case 'CASH':
            cashRevenue += payment.amount
            break
          case 'BANK_TRANSFER':
            bankRevenue += payment.amount
            break
          case 'QR_VIETQR':
            qrRevenue += payment.amount
            break
          case 'CARD':
          case 'CREDIT_CARD':
            cardRevenue += payment.amount
            break
        }
      })
    })

    // Group by date
    const dailyData: Record<string, any> = {}
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]
      dailyData[dateKey] = {
        date: dateKey,
        revenue: 0,
        bookings: 0,
        checkedIn: 0,
      }
    }

    bookings.forEach(booking => {
      const dateKey = booking.createdAt.toISOString().split('T')[0]
      if (dailyData[dateKey]) {
        dailyData[dateKey].revenue += booking.totalAmount
        dailyData[dateKey].bookings++
        if (booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') {
          dailyData[dateKey].checkedIn++
        }
      }
    })

    // Summary statistics
    const summary = {
      totalRevenue,
      totalBookings: bookings.length,
      averageBookingValue: bookings.length > 0 ? totalRevenue / bookings.length : 0,
      cashRevenue,
      bankRevenue,
      qrRevenue,
      cardRevenue,
      totalRooms,
      occupancyRate: 0, // Calculate based on room nights
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        daily: Object.values(dailyData).sort((a: any, b: any) => a.date.localeCompare(b.date)),
        bookings: bookings.slice(0, 20), // Recent bookings
      },
      meta: {
        propertyId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    })
  } catch (error) {
    console.error('Get revenue report error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy báo cáo doanh thu' }, { status: 500 })
  }
}
