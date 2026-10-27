import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revenueReport } from '@/lib/reports/revenue-report'
import { accessibleProperties } from '@/lib/auth/access'

// Force dynamic rendering - required because we use auth() which calls headers()
export const dynamic = 'force-dynamic'

/**
 * GET /api/reports/daily?propertyId=...&date=YYYY-MM-DD
 *
 * The cash book (Sổ quỹ) of one Vietnam day at a property. Money follows
 * the revenue report's rules (src/lib/reports/revenue.ts), so both reports
 * agree on any day:
 *   - totalIn       money received: payments whose paidAt is in the day,
 *                   whatever happened to them later
 *   - totalOut      money given back in the day: refunds at their refund
 *                   time, for the amount refunded (a partial refund too)
 *   - bookings      (count of bookings created on this date)
 *   - checkIns      (bookings whose actualCheckIn fell on this date)
 *   - checkOuts     (bookings whose actualCheckOut fell on this date)
 *   - transactions  every movement of money in the day, plus check-in/out
 *                   events (type EVENT, no amount), for the table
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

    // Access control: the cash book (cashbook_view), the front desk's own
    // report in the presets.
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ...accessibleProperties(session.user.id, 'cashbook_view') },
      select: { id: true, name: true },
    })
    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Không có quyền truy cập' },
        { status: 403 }
      )
    }

    // The hotel's day: 00:00 → 23:59:59 in Vietnam time (UTC+7, no daylight saving)
    const start = new Date(`${dateStr}T00:00:00.000+07:00`)
    const end = new Date(`${dateStr}T23:59:59.999+07:00`)
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json(
        { success: false, error: 'date không hợp lệ (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const [report, bookings, checkIns, checkOuts] = await Promise.all([
      revenueReport({ propertyId, start, end, groupBy: 'day', withRows: true }),
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
    ])

    const totalIn = report.summary.received
    const totalOut = report.summary.refunded
    const balance = report.summary.net
    const rows = report.rows ?? []

    // Money received by payment method, for the breakdown cards
    const byMethod = new Map<string, { amount: number; count: number }>()
    for (const r of rows) {
      if (r.kind !== 'IN') continue
      const entry = byMethod.get(r.method) ?? { amount: 0, count: 0 }
      entry.amount += r.amount
      entry.count += 1
      byMethod.set(r.method, entry)
    }
    const methodBreakdown = [...byMethod].map(([method, value]) => ({ method, ...value }))

    // Flatten to a unified "transaction" list for the report table. `category`
    // and `method` are codes: the page names them in the viewer's language.
    const transactions: Array<{
      id: string
      /** EVENT: a check-in or check-out, no money */
      type: 'IN' | 'OUT' | 'EVENT'
      category: 'PAYMENT' | 'REFUND' | 'CHECK_IN' | 'CHECK_OUT'
      /** the booking ("MB-10206 — guest"), null for a payment without one */
      description: string | null
      amount: number
      /** PaymentMethod code, null for check-in / check-out */
      method: string | null
      /** HH:mm, Vietnam time */
      createdAt: string
    }> = []

    rows.forEach((r, i) => {
      const isRefund = r.kind === 'REFUND'
      transactions.push({
        id: `${isRefund ? 'refund' : 'in'}-${i}`,
        type: isRefund ? 'OUT' : 'IN',
        category: isRefund ? 'REFUND' : 'PAYMENT',
        description: `${r.bookingCode} — ${r.guestName}`,
        amount: r.amount,
        method: r.method,
        createdAt: vnTime(new Date(r.at)),
      })
    })

    // Append check-in / check-out events
    for (const b of checkIns) {
      transactions.push({
        id: `checkin-${b.id}`,
        type: 'EVENT',
        category: 'CHECK_IN',
        description: `${b.bookingCode} — ${b.guestName}`,
        amount: 0,
        method: null,
        createdAt: vnTime(b.actualCheckIn!),
      })
    }
    for (const b of checkOuts) {
      transactions.push({
        id: `checkout-${b.id}`,
        type: 'EVENT',
        category: 'CHECK_OUT',
        description: `${b.bookingCode} — ${b.guestName}`,
        amount: 0,
        method: null,
        createdAt: vnTime(b.actualCheckOut!),
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
        methodBreakdown,
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

/** HH:mm in Vietnam time (UTC+7). */
function vnTime(d: Date): string {
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(11, 16)
}
