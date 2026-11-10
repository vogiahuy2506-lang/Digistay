import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { getPlatformPlanDetails } from '@/lib/plans/dynamic-plans'
import { PlanSchema } from '../route'

export const dynamic = 'force-dynamic'

const CORE_PLANS = ['starter', 'growth', 'business']

/**
 * GET /api/admin/plans/[id] — Retrieve plan details.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { id } = await props.params
  const plan = await getPlatformPlanDetails(id)
  return NextResponse.json({ success: true, data: plan })
}

/**
 * DELETE /api/admin/plans/[id] — Super Admin deletes a custom plan.
 * Core plans (starter, growth, business) and plans in active use cannot be deleted.
 */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { id } = await props.params

  // 1. Prevent deleting core system plans
  if (CORE_PLANS.includes(id)) {
    return NextResponse.json(
      { success: false, error: `Không thể xóa gói cốt lõi của hệ thống (${id}). Bạn có thể chuyển trạng thái sang "Tạm dừng" nếu không muốn bán nữa.` },
      { status: 400 }
    )
  }

  // 2. Check if any workspace is currently subscribed
  const activeSubsCount = await prisma.subscription.count({
    where: { plan: id },
  })
  if (activeSubsCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Không thể xóa gói "${id}" vì hiện có ${activeSubsCount} workspace đang sử dụng. Hãy chuyển các workspace sang gói khác trước khi xóa.`,
      },
      { status: 409 }
    )
  }

  // 3. Delete from database
  try {
    await prisma.platformPlan.delete({
      where: { id },
    })

    // Audit log
    await prisma.activityLog.create({
      data: {
        userId: check.admin.id,
        action: 'DELETE_PLAN',
        entityType: 'PLATFORM_PLAN',
        entityId: id,
        metadata: { deletedPlanId: id },
      },
    })

    return NextResponse.json({ success: true, message: `Đã xóa gói "${id}" thành công.` })
  } catch {
    return NextResponse.json(
      { success: false, error: `Không tìm thấy gói "${id}" để xóa.` },
      { status: 404 }
    )
  }
}
