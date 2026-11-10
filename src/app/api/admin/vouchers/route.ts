import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateVoucherSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Mã voucher phải có ít nhất 3 ký tự')
    .max(30, 'Mã voucher tối đa 30 ký tự')
    .transform((val) => val.toUpperCase())
    .refine((val) => /^[A-Z0-9_-]+$/.test(val), 'Mã voucher chỉ gồm chữ cái, số, gạch nối'),
  name: z.string().trim().min(2, 'Tên voucher phải có ít nhất 2 ký tự').max(100),
  discountType: z.enum(['PERCENT', 'FIXED_AMOUNT']).default('PERCENT'),
  discountValue: z.number().positive('Giá trị giảm phải lớn hơn 0'),
  maxDiscount: z.number().positive().nullable().optional(),
  minOrderAmount: z.number().nonnegative().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
  usageLimit: z.number().int().positive().nullable().optional(),
  applicablePlans: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

/**
 * GET /api/admin/vouchers — Superadmin lists all promotional vouchers.
 */
export async function GET(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const searchParams = request.nextUrl.searchParams
  const q = searchParams.get('q')?.trim()
  const status = searchParams.get('status') || 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '25', 10)))
  const skip = (page - 1) * size

  const now = new Date()
  const where: Prisma.PlatformVoucherWhereInput = { deletedAt: null }

  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (status === 'active') {
    where.isActive = true
    where.endDate = { gte: now }
  } else if (status === 'expired') {
    where.endDate = { lt: now }
  } else if (status === 'inactive') {
    where.isActive = false
  }

  const [rows, total, summary] = await Promise.all([
    prisma.platformVoucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    }),
    prisma.platformVoucher.count({ where }),
    prisma.platformVoucher.aggregate({
      where: { deletedAt: null },
      _count: { id: true },
      _sum: { usageCount: true },
    }),
  ])

  const activeCount = await prisma.platformVoucher.count({
    where: { deletedAt: null, isActive: true, endDate: { gte: now } },
  })

  return NextResponse.json({
    success: true,
    data: {
      rows,
      total,
      page,
      size,
      summary: {
        totalVouchers: summary._count.id,
        activeVouchers: activeCount,
        totalUsage: summary._sum.usageCount || 0,
      },
    },
  })
}

/**
 * POST /api/admin/vouchers — Superadmin creates a new promotional voucher.
 */
export async function POST(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = CreateVoucherSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu voucher không hợp lệ' },
      { status: 400 }
    )
  }

  const {
    code,
    name,
    discountType,
    discountValue,
    maxDiscount,
    minOrderAmount,
    startDate,
    endDate,
    usageLimit,
    applicablePlans,
    isActive,
  } = parsed.data

  if (discountType === 'PERCENT' && (discountValue <= 0 || discountValue > 100)) {
    return NextResponse.json(
      { success: false, error: 'Phần trăm giảm giá phải từ 1% đến 100%' },
      { status: 400 }
    )
  }

  const parsedStart = startDate ? new Date(startDate) : new Date()
  const parsedEnd = new Date(endDate)
  if (parsedEnd <= parsedStart) {
    return NextResponse.json(
      { success: false, error: 'Ngày kết thúc phải sau ngày bắt đầu' },
      { status: 400 }
    )
  }

  const existing = await prisma.platformVoucher.findUnique({
    where: { code },
  })
  if (existing && !existing.deletedAt) {
    return NextResponse.json(
      { success: false, error: `Mã voucher "${code}" đã tồn tại trên hệ thống` },
      { status: 409 }
    )
  }

  const voucher = await prisma.platformVoucher.upsert({
    where: { code },
    create: {
      code,
      name,
      discountType,
      discountValue,
      maxDiscount: discountType === 'PERCENT' ? maxDiscount : null,
      minOrderAmount,
      startDate: parsedStart,
      endDate: parsedEnd,
      usageLimit,
      applicablePlans,
      isActive,
    },
    update: {
      name,
      discountType,
      discountValue,
      maxDiscount: discountType === 'PERCENT' ? maxDiscount : null,
      minOrderAmount,
      startDate: parsedStart,
      endDate: parsedEnd,
      usageLimit,
      applicablePlans,
      isActive,
      deletedAt: null,
    },
  })

  await prisma.activityLog.create({
    data: {
      action: 'PLATFORM_VOUCHER_CREATED',
      entityType: 'PLATFORM_VOUCHER',
      entityId: voucher.id,
      userId: check.admin.id,
      metadata: { code, name, discountType, discountValue, by: check.admin.email },
    },
  })

  return NextResponse.json({ success: true, data: voucher }, { status: 201 })
}
