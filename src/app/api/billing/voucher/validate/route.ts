import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPlatformPlanPrice } from '@/lib/plans/dynamic-plans'

const schema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập mã voucher'),
  plan: z.string().trim().min(1),
  billing: z.enum(['MONTH', 'YEAR']),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập để sử dụng voucher' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Vui lòng nhập mã voucher' }, { status: 400 })
  }

  const code = parsed.data.code.trim().toUpperCase()
  const now = new Date()
  const voucher = await prisma.platformVoucher.findUnique({ where: { code } })

  if (!voucher || !voucher.isActive || voucher.deletedAt || voucher.startDate > now || voucher.endDate < now) {
    return NextResponse.json({ success: false, error: 'Mã voucher không hợp lệ hoặc đã hết hạn' }, { status: 400 })
  }

  if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
    return NextResponse.json({ success: false, error: 'Mã voucher đã hết lượt sử dụng' }, { status: 400 })
  }

  if (voucher.applicablePlans) {
    const allowed = voucher.applicablePlans.split(',').map((p) => p.trim().toLowerCase())
    if (!allowed.includes(parsed.data.plan.toLowerCase())) {
      return NextResponse.json({ success: false, error: 'Mã voucher không áp dụng cho gói này' }, { status: 400 })
    }
  }

  const originalAmount = await getPlatformPlanPrice(parsed.data.plan, parsed.data.billing)
  if (voucher.minOrderAmount !== null && originalAmount < voucher.minOrderAmount) {
    return NextResponse.json({ success: false, error: 'Đơn hàng chưa đạt giá trị tối thiểu để áp dụng voucher này' }, { status: 400 })
  }

  let discount = 0
  if (voucher.discountType === 'PERCENT') {
    discount = Math.round(originalAmount * (voucher.discountValue / 100))
    if (voucher.maxDiscount !== null && discount > voucher.maxDiscount) {
      discount = Math.round(voucher.maxDiscount)
    }
  } else {
    discount = Math.round(voucher.discountValue)
  }
  discount = Math.min(discount, originalAmount)
  const finalAmount = Math.max(1000, originalAmount - discount)

  return NextResponse.json({
    success: true,
    data: {
      code: voucher.code,
      name: voucher.name,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      discountAmount: discount,
      originalAmount,
      finalAmount,
    },
  })
}
