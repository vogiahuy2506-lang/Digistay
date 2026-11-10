import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PatchVoucherSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  discountValue: z.number().positive().optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  minOrderAmount: z.number().nonnegative().nullable().optional(),
  endDate: z.string().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  applicablePlans: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

/**
 * PATCH /api/admin/vouchers/[id] — Superadmin updates a promotional voucher.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = PatchVoucherSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 }
    )
  }

  const existing = await prisma.platformVoucher.findUnique({
    where: { id },
  })
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy voucher' }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.discountValue !== undefined) updateData.discountValue = parsed.data.discountValue
  if (parsed.data.maxDiscount !== undefined) updateData.maxDiscount = parsed.data.maxDiscount
  if (parsed.data.minOrderAmount !== undefined) updateData.minOrderAmount = parsed.data.minOrderAmount
  if (parsed.data.usageLimit !== undefined) updateData.usageLimit = parsed.data.usageLimit
  if (parsed.data.applicablePlans !== undefined) updateData.applicablePlans = parsed.data.applicablePlans
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive
  if (parsed.data.endDate !== undefined) updateData.endDate = new Date(parsed.data.endDate)

  const updated = await prisma.platformVoucher.update({
    where: { id },
    data: updateData,
  })

  await prisma.activityLog.create({
    data: {
      action: 'PLATFORM_VOUCHER_UPDATED',
      entityType: 'PLATFORM_VOUCHER',
      entityId: id,
      userId: check.admin.id,
      metadata: JSON.parse(JSON.stringify({ code: existing.code, changes: updateData, by: check.admin.email })),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

/**
 * DELETE /api/admin/vouchers/[id] — Superadmin soft-deletes a voucher.
 */
export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const existing = await prisma.platformVoucher.findUnique({
    where: { id },
  })
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy voucher' }, { status: 404 })
  }

  await prisma.platformVoucher.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })

  await prisma.activityLog.create({
    data: {
      action: 'PLATFORM_VOUCHER_DELETED',
      entityType: 'PLATFORM_VOUCHER',
      entityId: id,
      userId: check.admin.id,
      metadata: { code: existing.code, by: check.admin.email },
    },
  })

  return NextResponse.json({ success: true })
}
