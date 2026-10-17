import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * GET /api/reports/daily?propertyId=...&date=YYYY-MM-DD
 *
 * Returns the cash flow summary for a single day at a property:
 *   - totalIn       (sum of all PAID payments on this date)
 *   - totalOut      (sum of all REFUNDED payments on this date)
 *   - bookings      (count of bookings created on this date)
 *   - checkIns      (bookings whose actualCheckIn fell on this date)
 *   - checkOuts     (bookings whose actualCheckOut fell on this date)
 *   - transactions  (a flat list of every PAID/REFUNDED payment that
 *                    happened on the date, plus check-in/out events,
 *                    formatted for the daily report table)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')
    const dateStr = searchParams.get('date')

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }
    if (!propertyId || !dateStr) {
      return NextResponse.json(
        { success: false, error: 'Thiếu propertyId hoặc date' },
        { status: 400 }
      )
    }

    // Access control: owner or member of the workspace
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
      select: { id: true, name: true },
    })
    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Không có quyền truy cập' },
        { status: 403 }
      )
    }

    // Date range: 00:00 → 23:59:59 in UTC
    const start = new Date(`${dateStr}T00:00:00.000Z`)
    const end = new Date(`${dateStr}T23:59:59.999Z`)
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json(
        { success: false, error: 'date không hợp lệ (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const [paidAgg, refundedAgg, bookings, checkIns, checkOuts, payments] =
      await Promise.all([
        prisma.payment.aggregate({
          where: {
            propertyId,
            status: 'PAID',
            paidAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.payment.aggregate({
          where: {
            propertyId,
            status: 'REFUNDED',
            updatedAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.booking.count({
          where: {
            propertyId,
            createdAt: { gte: start, lte: end },
          },
        }),
        prisma.booking.findMany({
          where: {
            propertyId,
            actualCheckIn: { gte: start, lte: end },
          },
          select: { id: true, bookingCode: true, guestName: true, actualCheckIn: true },
        }),
        prisma.booking.findMany({
          where: {
            propertyId,
            actualCheckOut: { gte: start, lte: end },
          },
          select: { id: true, bookingCode: true, guestName: true, actualCheckOut: true },
        }),
        prisma.payment.findMany({
          where: {
            propertyId,
            OR: [
              { paidAt: { gte: start, lte: end } },
              { status: 'REFUNDED', updatedAt: { gte: start, lte: end } },
            ],
          },
          include: {
            booking: { select: { bookingCode: true, guestName: true } },
            // No createdBy relation on Payment — show the owner email of
            // the workspace as the actor in a real implementation. We
            // skip that here to avoid extra queries.
          },
          orderBy: { paidAt: 'desc' },
        }),
      ])

    const totalIn = paidAgg._sum.amount ?? 0
    const totalOut = refundedAgg._sum.amount ?? 0
    const balance = totalIn - totalOut

    // Flatten to a unified "transaction" list for the report table
    const transactions: Array<{
      id: string
      type: 'IN' | 'OUT'
      category: string
      description: string
      amount: number
      paymentMethod: string
      createdAt: string
    }> = []

    for (const p of payments) {
      const isRefund = p.status === 'REFUNDED'
      const time = (p.paidAt ?? p.updatedAt).toISOString().slice(11, 16)
      transactions.push({
        id: p.id,
        type: isRefund ? 'OUT' : 'IN',
        category: isRefund ? 'Hoàn tiền' : 'Thanh toán',
        description: `${p.booking.bookingCode} — ${p.booking.guestName}`,
        amount: p.amount,
        paymentMethod: methodLabel(p.method),
        createdAt: time,
      })
    }

    // Append check-in / check-out events
    for (const b of checkIns) {
      transactions.push({
        id: `checkin-${b.id}`,
        type: 'OUT', // not strictly cash flow, marked as a service event
        category: 'Check-in',
        description: `${b.bookingCode} — ${b.guestName}`,
        amount: 0,
        paymentMethod: '—',
        createdAt: b.actualCheckIn!.toISOString().slice(11, 16),
      })
    }
    for (const b of checkOuts) {
      transactions.push({
        id: `checkout-${b.id}`,
        type: 'IN',
        category: 'Check-out',
        description: `${b.bookingCode} — ${b.guestName}`,
        amount: 0,
        paymentMethod: '—',
        createdAt: b.actualCheckOut!.toISOString().slice(11, 16),
      })
    }

    // Sort by time asc
    transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          date: dateStr,
          totalIn,
          totalOut,
          balance,
          bookings,
          checkIns: checkIns.length,
          checkOuts: checkOuts.length,
        },
        transactions,
      },
    })
  } catch (error) {
    console.error('Daily report error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi lấy báo cáo' },
      { status: 500 }
    )
  }
}

function methodLabel(m: string): string {
  switch (m) {
    case 'BANK_TRANSFER':
      return 'Chuyển khoản'
    case 'QR_VIETQR':
      return 'QR VietQR'
    case 'CARD':
    case 'CREDIT_CARD':
      return 'Thẻ tín dụng'
    case 'E_WALLET':
      return 'Ví điện tử'
    case 'CASH':
      return 'Tiền mặt'
    default:
      return m
  }
}
