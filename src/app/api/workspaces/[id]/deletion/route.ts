import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { workspacePlan } from '@/lib/billing/subscription'
import { guestsBooked, liveWorkspaceForOwner, openPlanPayment } from '@/lib/deletion/deletion'
import { RESTORE_DAYS } from '@/lib/deletion/rules'

/**
 * GET /api/workspaces/[id]/deletion — what deleting the workspace involves,
 * for the owner's confirm dialog: the name to type, its properties and
 * members (who lose access at once), the guests booked and an open plan
 * payment (which stop it), and the plan's remaining time, which is not
 * refunded (the plan keeps its end date if the workspace is restored).
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  const found = await liveWorkspaceForOwner(id, session.user.id)
  if (!found.ok) {
    return found.status === 404
      ? NextResponse.json({ success: false, error: 'Không tìm thấy workspace' }, { status: 404 })
      : NextResponse.json({ success: false, error: 'Chỉ chủ sở hữu mới có thể xóa workspace' }, { status: 403 })
  }

  const [booked, properties, members, planPaymentOpen, plan] = await Promise.all([
    guestsBooked(prisma, { workspaceId: id }),
    prisma.property.count({ where: { workspaceId: id } }),
    prisma.workspaceMember.count({ where: { workspaceId: id } }),
    openPlanPayment(id),
    workspacePlan(id),
  ])
  return NextResponse.json({
    success: true,
    data: {
      name: found.row.name,
      booked,
      properties,
      members,
      planPaymentOpen,
      plan: {
        planId: plan.planId,
        trial: plan.subscription.trial,
        state: plan.state,
        daysLeft: plan.daysLeft,
        periodEnd: plan.subscription.periodEnd.toISOString(),
      },
      restoreDays: RESTORE_DAYS,
    },
  })
}
