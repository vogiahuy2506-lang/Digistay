import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { getPlatformPlans } from '@/lib/plans/dynamic-plans'
import { PLAN_IDS, type PlanId } from '@/lib/marketing/plans'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdatePlanSchema = z.object({
  id: z.enum(PLAN_IDS),
  price: z.number().int().min(1000).max(100_000_000),
  properties: z.number().int().min(1).max(1000),
  rooms: z.number().int().min(1).max(5000),
  staff: z.number().int().min(1).max(1000),
  invoices: z.number().int().min(0).max(50000).default(0),
  isActive: z.boolean().optional().default(true),
})

/**
 * GET /api/admin/plans — Superadmin lists all plans and their settings.
 */
export async function GET() {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const plans = await getPlatformPlans()
  return NextResponse.json({ success: true, data: plans })
}

/**
 * PUT /api/admin/plans — Superadmin updates a plan's price and limits.
 */
export async function PUT(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = UpdatePlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dữ liệu gói không hợp lệ', details: parsed.error.format() }, { status: 400 })
  }

  const { id, price, properties, rooms, staff, invoices, isActive } = parsed.data
  const name = id.charAt(0).toUpperCase() + id.slice(1)

  const updated = await prisma.platformPlan.upsert({
    where: { id },
    create: {
      id,
      name,
      price,
      properties,
      rooms,
      staff,
      invoices,
      isActive,
    },
    update: {
      name,
      price,
      properties,
      rooms,
      staff,
      invoices,
      isActive,
    },
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      action: 'PLAN_UPDATED',
      entityType: 'PLATFORM_PLAN',
      entityId: id,
      userId: check.admin.id,
      metadata: {
        id,
        price,
        properties,
        rooms,
        staff,
        invoices,
      },
    },
  }).catch(() => null)

  return NextResponse.json({ success: true, data: updated })
}

