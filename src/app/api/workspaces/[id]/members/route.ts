import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAccess } from '@/lib/auth/access'
import { effectivePermissions } from '@/lib/auth/permissions'
import { memberProblem } from '@/lib/members/grant'
import { workspacePlan } from '@/lib/billing/subscription'
import { workspaceUsage } from '@/lib/billing/limits'

/**
 * GET — the members page (members_manage): the owner and every member with
 * their access, the workspace's properties to choose from, the staff seats
 * of the plan, and what the caller may change.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const granted = await requireAccess(id, 'members_manage')
    if (!granted.ok) return granted.response
    const { access } = granted

    const [workspace, members, properties, plan, usage] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id },
        select: { owner: { select: { id: true, name: true, email: true, image: true } }, createdAt: true },
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId: id },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          properties: { select: { propertyId: true } },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.property.findMany({ where: { workspaceId: id }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } }),
      workspacePlan(id),
      workspaceUsage(id),
    ])
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy workspace' }, { status: 404 })
    }

    const owner = workspace.owner
    const rows = members
      .filter((m) => m.userId !== owner.id)
      .map((m) => {
        const propertyIds = m.properties.map((p) => p.propertyId)
        return {
          id: m.id,
          user: m.user,
          role: m.role,
          customPermissions: m.customPermissions,
          permissions: effectivePermissions(m),
          allProperties: m.allProperties,
          propertyIds,
          joinedAt: m.joinedAt.toISOString(),
          disabledAt: m.disabledAt?.toISOString() ?? null,
          planLockedAt: m.planLockedAt?.toISOString() ?? null,
          isOwner: false,
          isSelf: m.userId === access.userId,
          // Why the caller may not change them, if so (the page greys the actions out).
          locked: memberProblem(access, { ...m, propertyIds }),
        }
      })

    return NextResponse.json({
      success: true,
      data: {
        owner: { ...owner, joinedAt: workspace.createdAt.toISOString(), isSelf: owner.id === access.userId },
        members: rows,
        properties,
        seats: { used: usage.staff, limit: plan.plan.staff },
        me: {
          isOwner: access.isOwner,
          permissions: [...access.permissions],
          propertyIds: access.propertyIds,
        },
      },
    })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách thành viên' },
      { status: 500 }
    )
  }
}
