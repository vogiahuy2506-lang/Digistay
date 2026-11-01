import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { checkPropertyAccess } from '@/lib/auth/access'
import { couponInputSchema, normalizeCouponCode } from '@/lib/marketing/coupons'

type Props = { params: Promise<{ id: string; couponId: string }> }

const notFound = () => NextResponse.json({ success: false, error: 'Không tìm thấy mã giảm giá' }, { status: 404 })

/** PATCH — update a coupon. property_edit. Code stays unique within the property. */
export async function PATCH(request: NextRequest, props: Props) {
  const { id, couponId } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const access = await checkPropertyAccess(session.user.id, id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

    const stored = await prisma.coupon.findFirst({ where: { id: couponId, propertyId: id, deletedAt: null } })
    if (!stored) return notFound()

    const body = await request.json().catch(() => null)
    const merged = {
      code: body?.code ?? stored.code,
      name: body?.name ?? stored.name,
      discountType: body?.discountType ?? stored.discountType,
      discountValue: body?.discountValue ?? stored.discountValue,
      maxDiscount: body?.maxDiscount ?? stored.maxDiscount ?? undefined,
      minOrderAmount: body?.minOrderAmount ?? stored.minOrderAmount ?? undefined,
      startDate: body?.startDate ?? stored.startDate,
      endDate: body?.endDate ?? stored.endDate,
      usageLimit: body?.usageLimit ?? stored.usageLimit ?? undefined,
      isActive: body?.isActive ?? stored.isActive,
    }
    const parsed = couponInputSchema.safeParse(merged)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }

    const code = normalizeCouponCode(parsed.data.code)
    if (!code) {
      return NextResponse.json({ success: false, error: 'Mã ưu đãi chỉ gồm chữ và số' }, { status: 400 })
    }
    if (code !== stored.code) {
      const dup = await prisma.coupon.findFirst({ where: { propertyId: id, code, deletedAt: null }, select: { id: true } })
      if (dup) {
        return NextResponse.json({ success: false, error: 'Mã ưu đãi đã tồn tại trong cơ sở này' }, { status: 409 })
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
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
        propertyId: id,
        action: 'UPDATE',
        entityType: 'COUPON',
        entityId: coupon.id,
      },
    })
    return NextResponse.json({ success: true, data: coupon, message: 'Đã cập nhật mã giảm giá' })
  } catch (error) {
    console.error('Update coupon error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật mã giảm giá' }, { status: 500 })
  }
}

/** DELETE — soft-delete a coupon (bookings keep couponCode for history). property_edit. */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id, couponId } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const access = await checkPropertyAccess(session.user.id, id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

    const { count } = await prisma.coupon.updateMany({
      where: { id: couponId, propertyId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (count === 0) return notFound()
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: access.property.workspaceId,
        propertyId: id,
        action: 'DELETE',
        entityType: 'COUPON',
        entityId: couponId,
      },
    })
    return NextResponse.json({ success: true, message: 'Đã xóa mã giảm giá' })
  } catch (error) {
    console.error('Delete coupon error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa mã giảm giá' }, { status: 500 })
  }
}
