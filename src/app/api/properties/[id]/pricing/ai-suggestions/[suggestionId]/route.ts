import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import {
  applyDynamicPricingSuggestion,
  dismissDynamicPricingSuggestion,
} from '@/lib/pricing/dynamic-pricing'

async function propertyForDynamicPricing(propertyId: string, userId: string) {
  return prisma.property.findFirst({
    where: { id: propertyId, ...accessibleProperties(userId, 'room_types_manage') },
    select: { id: true, workspaceId: true },
  })
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; suggestionId: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id, suggestionId } = params

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

    const suggestion = await prisma.dynamicPricingSuggestion.findFirst({
      where: { id: suggestionId, propertyId: id },
    })

    if (!suggestion) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy gợi ý định giá' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === 'apply') {
      const updated = await applyDynamicPricingSuggestion(suggestionId, session.user.id)
      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Đã áp dụng mức giá gợi ý thành công',
      })
    }

    if (action === 'dismiss') {
      const updated = await dismissDynamicPricingSuggestion(suggestionId)
      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Đã bỏ qua gợi ý này',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Hành động không hợp lệ' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Update dynamic pricing suggestion error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật gợi ý giá' },
      { status: 500 }
    )
  }
}
