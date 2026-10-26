import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { isValidTiers } from '@/lib/bookings/late-checkout'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { lockedResponseForProperty } from '@/lib/billing/guard'

const policySchema = z.object({
  checkInTime: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'checkInTime phải có dạng HH:MM')
    .optional(),
  checkOutTime: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'checkOutTime phải có dạng HH:MM')
    .optional(),
  cancellationHours: z.coerce.number().int().min(0).max(720).nullable().optional(),
  cancellationPolicy: z.string().max(2000).nullable().optional(),
  lateCancelRefundPercent: z.coerce.number().int('Phần trăm hoàn là số nguyên').min(0).max(100, 'Phần trăm hoàn tối đa 100%').optional(),
  childrenAllowed: z.boolean().optional(),
  minChildAge: z.coerce.number().int().min(0).max(18).optional(),
  petsAllowed: z.boolean().optional(),
  smokingAllowed: z.boolean().optional(),
  additionalRules: z.string().max(2000).nullable().optional(),
  /** % of the total a guest pays through PayOS when booking on the site; 0 = none */
  onlineDepositPercent: z.coerce.number().int('Tiền cọc là số nguyên phần trăm').min(0).max(100, 'Tiền cọc tối đa 100%').optional(),
  /** late check-out tiers (src/lib/bookings/late-checkout.ts); null = the default, [] = none */
  lateCheckoutTiers: z
    .unknown()
    .refine((v) => v === null || isValidTiers(v), 'Mức phí trả muộn không hợp lệ: giờ tăng dần, mỗi mức 0–300%')
    .optional(),
  /** minutes to pay that deposit before the booking is cancelled; 0 = never */
  depositDeadlineMinutes: z.coerce
    .number()
    .int()
    .refine((m) => m === 0 || (m >= 15 && m <= 1440), 'Hạn đặt cọc từ 15 phút tới 24 giờ, hoặc 0 (không tự huỷ)')
    .optional(),
  translations: translationsInput(['cancellationPolicy', 'additionalRules'], 2000),
})

async function userCanEditProperty(propertyId: string, userId: string) {
  return prisma.property.findFirst({
    where: {
      id: propertyId,
      workspace: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: { in: ['ADMIN', 'MANAGER'] }, planLockedAt: null } } },
        ],
      },
    },
    select: { id: true },
  })
}

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const ok = await userCanEditProperty(params.id, session.user.id)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 })
    }

    // Auto-create a default policy if missing so the form always has
    // something to display
    const policy = await prisma.policy.upsert({
      where: { propertyId: params.id },
      create: { propertyId: params.id },
      update: {},
    })
    // The online deposit only applies with a connected PayOS account: the page says so.
    const payos = await prisma.propertyPayos.findUnique({
      where: { propertyId: params.id },
      select: { webhookConfirmedAt: true },
    })

    return NextResponse.json({ success: true, data: { ...policy, payosConnected: Boolean(payos?.webhookConfirmedAt) } })
  } catch (error) {
    console.error('Get policy error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi lấy chính sách' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const ok = await userCanEditProperty(params.id, session.user.id)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Không có quyền chỉnh sửa' },
        { status: 403 }
      )
    }
    const locked = await lockedResponseForProperty(params.id)
    if (locked) return locked

    const body = await request.json()
    const validation = policySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Strip undefined fields so they don't overwrite existing data
    const { lateCheckoutTiers, translations, ...fields } = validation.data
    const stored = translations && (await prisma.policy.findUnique({ where: { propertyId: params.id }, select: { translations: true } }))
    const data = {
      ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
      // null: back to the default tiers (a JSON column needs Prisma's DbNull).
      ...(lateCheckoutTiers !== undefined && {
        lateCheckoutTiers: lateCheckoutTiers === null ? Prisma.DbNull : (lateCheckoutTiers as unknown as Prisma.InputJsonValue),
      }),
      ...(translations && { translations: mergeTranslations(stored?.translations, translations) }),
    }

    const policy = await prisma.policy.upsert({
      where: { propertyId: params.id },
      create: { propertyId: params.id, ...data },
      update: data,
    })

    return NextResponse.json({
      success: true,
      data: policy,
      message: 'Đã cập nhật chính sách',
    })
  } catch (error) {
    console.error('Update policy error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi cập nhật chính sách' },
      { status: 500 }
    )
  }
}
