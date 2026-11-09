import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { badParam, enumParam, pageParams, paginationOf, searchParam } from '@/lib/api/list-params'
import { Prisma } from '@prisma/client'

function escapeCsvField(value: unknown): string {
  if (value == null) return '""'
  const str = String(value)
  return `"${str.replace(/"/g, '""')}"`
}

/**
 * GET — list leads of a property (Task 44).
 * Any member with property access can view.
 * Supports query parameters:
 *  - page, limit, q (search email, name, phone)
 *  - source: 'all' | 'EXIT_POPUP' | 'CONTACT_FORM' | 'OTHER'
 *  - export: 'csv'
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const ok = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true, name: true },
    })
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 })
    }

    const search = new URL(request.url).searchParams
    const q = searchParam(search)
    const sourceRaw = enumParam(search.get('source'), ['EXIT_POPUP', 'CONTACT_FORM', 'OTHER', 'all'] as const)
    if (sourceRaw === null) return badParam('Nguồn không hợp lệ')
    const source = sourceRaw ?? 'all'

    const where: Prisma.LeadWhereInput = {
      propertyId: params.id,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(source !== 'all' ? { source } : {}),
    }

    // Export all leads (JSON or CSV)
    if (search.get('export') === 'json' || search.get('all') === '1') {
      const rows = await prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5000,
      })
      return NextResponse.json({ success: true, data: rows })
    }

    if (search.get('export') === 'csv') {
      const rows = await prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5000,
      })

      const headers = ['Thời gian', 'Email', 'Họ tên', 'Số điện thoại', 'Nguồn', 'Mã ưu đãi', 'Trang nguồn', 'Ghi chú']
      const sourceLabels: Record<string, string> = {
        EXIT_POPUP: 'Popup giữ chân',
        CONTACT_FORM: 'Form liên hệ',
        OTHER: 'Khác',
      }

      const csvLines = [
        headers.map(escapeCsvField).join(','),
        ...rows.map((row) => {
          const meta = (row.metadata as Record<string, unknown> | null) ?? {}
          const couponCode = meta.couponCode ? String(meta.couponCode) : ''
          const page = meta.page ? String(meta.page) : ''
          const d = new Date(row.createdAt)
          const dateStr = Number.isNaN(d.getTime())
            ? ''
            : d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

          return [
            escapeCsvField(dateStr),
            escapeCsvField(row.email),
            escapeCsvField(row.name ?? ''),
            escapeCsvField(row.phone ?? ''),
            escapeCsvField(sourceLabels[row.source] ?? row.source),
            escapeCsvField(couponCode),
            escapeCsvField(page),
            escapeCsvField(row.notes ?? ''),
          ].join(',')
        }),
      ]

      const BOM = '\uFEFF'
      const csv = BOM + csvLines.join('\r\n')
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `leads-${params.id}-${todayStr}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    const { page, limit, skip } = pageParams(search)
    const [rows, total, exitPopupCount, contactFormCount] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { propertyId: params.id, source: 'EXIT_POPUP' } }),
      prisma.lead.count({ where: { propertyId: params.id, source: 'CONTACT_FORM' } }),
    ])

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: paginationOf(page, limit, total),
      summary: {
        total,
        exitPopupCount,
        contactFormCount,
      },
    })
  } catch (error) {
    console.error('List leads error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách khách hàng tiềm năng' }, { status: 500 })
  }
}

