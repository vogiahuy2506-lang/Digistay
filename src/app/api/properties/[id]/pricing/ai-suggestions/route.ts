import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import {
  generateDynamicPricingSuggestions,
} from '@/lib/pricing/dynamic-pricing'
import type { DynamicPricingStatus } from '@prisma/client'

async function propertyForDynamicPricing(propertyId: string, userId: string) {
  return prisma.property.findFirst({
    where: { id: propertyId, ...accessibleProperties(userId, 'room_types_manage') },
    select: { id: true, workspaceId: true },
  })
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const property = await prisma.property.findFirst({
      where: { id, ...accessibleProperties(session.user.id) },
      select: { id: true },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập cơ sở này' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')?.toUpperCase()

    const whereClause: {
      propertyId: string
      status?: DynamicPricingStatus
    } = { propertyId: id }

    if (statusParam && statusParam !== 'ALL') {
      whereClause.status = statusParam as DynamicPricingStatus
    }

    const suggestions = await prisma.dynamicPricingSuggestion.findMany({
      where: whereClause,
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            slug: true,
            bedType: true,
          },
        },
      },
      orderBy: [{ targetDate: 'asc' }, { percentageChange: 'desc' }],
    })

    // Compute overview metrics
    const pendingCount = suggestions.filter((s) => s.status === 'PENDING').length
    const appliedCount = suggestions.filter((s) => s.status === 'APPLIED').length
    const avgChange =
      suggestions.length > 0
        ? Math.round(
            (suggestions.reduce((acc, s) => acc + s.percentageChange, 0) /
              suggestions.length) *
              10
          ) / 10
        : 0

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        metrics: {
          total: suggestions.length,
          pendingCount,
          appliedCount,
          avgChange,
        },
      },
    })
  } catch (error) {
    console.error('Get dynamic pricing suggestions error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy gợi ý giá' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const property = await propertyForDynamicPricing(id, session.user.id)
    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền cập nhật bảng giá này' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const daysAhead = typeof body.daysAhead === 'number' ? body.daysAhead : 30
    const model = typeof body.model === 'string' ? body.model : undefined

    const result = await generateDynamicPricingSuggestions(id, {
      daysAhead,
      model,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Đã phân tích và cập nhật ${result.createdCount} gợi ý định giá`,
    })
  } catch (error) {
    console.error('Generate dynamic pricing error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tạo gợi ý giá' },
      { status: 500 }
    )
  }
}
