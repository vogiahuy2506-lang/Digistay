import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { accessibleProperties, checkPropertyAccess } from '@/lib/auth/access'
import { couponInputSchema, normalizeCouponCode } from '@/lib/marketing/coupons'
import { badParam, enumParam, pageParams, paginationOf, searchParam } from '@/lib/api/list-params'
import { Prisma } from '@prisma/client'

/** GET — list coupons of a property (soft-deleted hidden). Any member with access. */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const ok = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true },
    })
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 })
    }

    const search = new URL(request.url).searchParams
    const { page, limit, skip } = pageParams(search)
    const q = searchParam(search)
    const statusRaw = enumParam(search.get('status'), ['active', 'inactive', 'all'] as const)
    if (statusRaw === null) return badParam('Trạng thái không hợp lệ')
    const status = statusRaw ?? 'all'

    const where: Prisma.CouponWhereInput = {
      propertyId: params.id,
      deletedAt: null,
      ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {}),
      ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.coupon.count({ where }),
    ])
    return NextResponse.json({ success: true, data: rows, pagination: paginationOf(page, limit, total) })
  } catch (error) {
    console.error('List coupons error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách mã giảm giá' }, { status: 500 })
  }
}

/** POST — create a coupon. property_edit. */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const access = await checkPropertyAccess(session.user.id, params.id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response
    const locked = await lockedResponseForProperty(params.id)
    if (locked) return locked

    const parsed = couponInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }
    const code = normalizeCouponCode(parsed.data.code)
    if (!code) {
      return NextResponse.json({ success: false, error: 'Mã ưu đãi chỉ gồm chữ và số' }, { status: 400 })
    }
    const dup = await prisma.coupon.findFirst({ where: { propertyId: params.id, code, deletedAt: null }, select: { id: true } })
    if (dup) {
      return NextResponse.json({ success: false, error: 'Mã ưu đãi đã tồn tại trong cơ sở này' }, { status: 409 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        propertyId: params.id,
        code,
        name: parsed.data.name.trim(),
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        maxDiscount: parsed.data.maxDiscount ?? null,
        minOrderAmount: parsed.data.minOrderAmount ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        usageLimit: parsed.data.usageLimit ?? null,
        isActive: parsed.data.isActive,
      },
    })
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: access.property.workspaceId,
        propertyId: params.id,
        action: 'CREATE',
        entityType: 'COUPON',
        entityId: coupon.id,
      },
    })
    return NextResponse.json({ success: true, data: coupon, message: 'Đã tạo mã giảm giá' })
  } catch (error) {
    console.error('Create coupon error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo mã giảm giá' }, { status: 500 })
  }
}
