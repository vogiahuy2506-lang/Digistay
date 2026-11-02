import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import type { Prisma } from '@prisma/client'

/**
 * GET /api/properties/[id]/customers
 * Tra cứu danh bạ khách hàng (Mini CRM) kèm phân trang, tìm kiếm, lọc theo tag và thống kê tổng quan.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await props.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, propertyId, 'bookings_view', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const q = (searchParams.get('q') || '').trim()
    const tag = (searchParams.get('tag') || '').trim()
    const sortBy = searchParams.get('sortBy') || 'lastStayAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const where: Prisma.CustomerProfileWhereInput = {
      propertyId,
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      }),
      ...(tag && {
        tags: { has: tag },
      }),
    }

    const validSortFields = ['lastStayAt', 'totalSpent', 'totalStays', 'createdAt', 'name']
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'lastStayAt'

    const [total, customers, summaryAgg, vipCount] = await Promise.all([
      prisma.customerProfile.count({ where }),
      prisma.customerProfile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: sortOrder },
      }),
      prisma.customerProfile.aggregate({
        where: { propertyId },
        _sum: {
          totalStays: true,
          totalSpent: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.customerProfile.count({
        where: {
          propertyId,
          tags: { has: 'VIP' },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalCustomers: summaryAgg._count.id || 0,
        totalStays: summaryAgg._sum.totalStays || 0,
        totalRevenue: summaryAgg._sum.totalSpent || 0,
        vipCount,
      },
    })
  } catch (error) {
    console.error('Fetch customers error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tải danh bạ khách hàng' }, { status: 500 })
  }
}
