import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { badParam, dayParam, enumParam } from '@/lib/api/list-params'
import { METHOD_GROUPS } from '@/lib/reports/revenue'
import { revenueReport } from '@/lib/reports/revenue-report'

export const dynamic = 'force-dynamic'

const MAX_REPORT_DAYS = 366
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * GET /api/reports/revenue?propertyId=&from=yyyy-mm-dd&to=yyyy-mm-dd
 *   &groupBy=day|month&method=CASH|BANK_TRANSFER|QR|CARD|E_WALLET&rows=1
 *
 * Days are Vietnam days; the default is the last 30 days. rows=1 adds every
 * movement and every invoice, for the export. The rules are in
 * src/lib/reports/revenue.ts.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    // Owner, ADMIN or MANAGER: revenue, and the guests behind each payment.
    // The sidebar shows this report to those roles only.
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
      select: { id: true },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    // A report reads every payment of its range, so the range is bounded;
    // an unreadable date used to reach Prisma as Invalid Date and come back
    // as a 500.
    const from = dayParam(searchParams.get('from'), 'from')
    const to = dayParam(searchParams.get('to'), 'to')
    if (from === null || to === null) return badParam('Ngày không hợp lệ')
    const end = to ?? new Date()
    const start = from ?? new Date(end.getTime() - 30 * DAY_MS)
    if (start > end) return badParam('Ngày bắt đầu phải trước ngày kết thúc')
    if (end.getTime() - start.getTime() > MAX_REPORT_DAYS * DAY_MS) {
      return badParam(`Mỗi báo cáo tối đa ${MAX_REPORT_DAYS} ngày`)
    }

    const groupBy = enumParam(searchParams.get('groupBy'), ['day', 'month'] as const)
    if (groupBy === null) return badParam('Cách nhóm không hợp lệ')
    const method = enumParam(searchParams.get('method'), METHOD_GROUPS)
    if (method === null) return badParam('Hình thức thanh toán không hợp lệ')

    const data = await revenueReport({
      propertyId,
      start,
      end,
      groupBy: groupBy ?? 'day',
      method,
      withRows: searchParams.get('rows') === '1',
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get revenue report error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy báo cáo doanh thu' }, { status: 500 })
  }
}
