import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkAccess, type Access } from '@/lib/auth/access'
import { effectivePermissions } from '@/lib/auth/permissions'
import { lockedResponse, planResponse } from '@/lib/billing/guard'
import { reconcileOverageSoon } from '@/lib/billing/overage'
import { grantProblem, grantSchema, memberProblem, toGrant } from '@/lib/members/grant'
import { logMemberActivity } from '@/lib/members/activity'

type Props = { params: Promise<{ id: string; memberId: string }> }

const MEMBER_NOT_FOUND = 'Không tìm thấy thành viên'

/** Change a member's access (grantSchema), or lock / unlock them ({ disabled }). */
const patchSchema = z.union([grantSchema.strict(), z.object({ disabled: z.boolean() }).strict()])

/**
 * The membership row with what the checks need, only if it belongs to this
 * workspace: member ids reach other members, so an admin of any workspace
 * must not act on another's rows.
 */
function memberOf(workspaceId: string, memberId: string) {
  return prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    include: {
      user: { select: { name: true, email: true } },
      properties: { select: { propertyId: true } },
      workspace: { select: { ownerId: true } },
    },
  })
}

/**
 * PATCH — members_manage: the member's role and permissions and properties,
 * or { disabled } to lock them out (no access, no staff seat) or let them
 * back in (which takes a seat again). Not the owner, not oneself, nobody
 * holding more than the caller (src/lib/members/grant.ts).
 */
export async function PATCH(request: NextRequest, props: Props) {
  const { id, memberId } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const granted = await checkAccess(session.user.id, id, 'members_manage')
    if (!granted.ok) return granted.response
    const { access } = granted
    const locked = await lockedResponse(id)
    if (locked) return locked

    const validation = patchSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp đầy đủ thông tin' }, { status: 400 })
    }

    const member = await memberOf(id, memberId)
    if (!member) {
      return NextResponse.json({ success: false, error: MEMBER_NOT_FOUND }, { status: 404 })
    }
    if (member.workspace.ownerId === member.userId) {
      return NextResponse.json({ success: false, error: 'Không thể thay đổi quyền của chủ sở hữu' }, { status: 400 })
    }
    const before = { ...member, propertyIds: member.properties.map((p) => p.propertyId) }
    const refused = memberProblem(access, before)
    if (refused) return NextResponse.json({ success: false, error: refused }, { status: 403 })
    const subject = { email: member.user.email, name: member.user.name }

    const body = validation.data
    if ('disabled' in body) {
      if (body.disabled === !!member.disabledAt) {
        return NextResponse.json({ success: true, message: 'Không có gì thay đổi' })
      }
      // Back in, they take a staff seat again.
      if (!body.disabled) {
        const overPlan = await planResponse(id, 'staff', 1)
        if (overPlan) return overPlan
      }
      await prisma.$transaction(async (tx) => {
        await tx.workspaceMember.update({ where: { id: member.id }, data: { disabledAt: body.disabled ? new Date() : null } })
        await logMemberActivity(tx, {
          workspaceId: id,
          actorId: access.userId,
          action: body.disabled ? 'MEMBER_LOCKED' : 'MEMBER_UNLOCKED',
          entityType: 'MEMBER',
          entityId: member.id,
          subject,
        })
      })
      // A freed seat may unlock someone locked for the plan.
      if (body.disabled) reconcileOverageSoon(id)
      return NextResponse.json({
        success: true,
        message: body.disabled ? 'Đã khoá thành viên' : 'Đã mở khoá thành viên',
      })
    }

    const properties = await prisma.property.findMany({ where: { workspaceId: id }, select: { id: true } })
    const grant = toGrant(body, properties.map((p) => p.id))
    if (typeof grant === 'string') return NextResponse.json({ success: false, error: grant }, { status: 400 })
    const tooWide = grantProblem(access, grant)
    if (tooWide) return NextResponse.json({ success: false, error: tooWide }, { status: 403 })

    const was = effectivePermissions(member)
    const now = effectivePermissions(grant)
    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({
        where: { id: member.id },
        data: {
          role: grant.role,
          customPermissions: grant.customPermissions,
          permissions: grant.permissions,
          allProperties: grant.allProperties,
        },
      })
      await tx.memberProperty.deleteMany({ where: { memberId: member.id } })
      if (!grant.allProperties) {
        await tx.memberProperty.createMany({ data: grant.propertyIds.map((propertyId) => ({ memberId: member.id, propertyId })) })
      }
      await logMemberActivity(tx, {
        workspaceId: id,
        actorId: access.userId,
        action: 'MEMBER_UPDATED',
        entityType: 'MEMBER',
        entityId: member.id,
        subject,
        changes: {
          role: [member.role, grant.role],
          added: now.filter((p) => !was.includes(p)),
          removed: was.filter((p) => !now.includes(p)),
          properties: [
            member.allProperties ? 'all' : before.propertyIds.length,
            grant.allProperties ? 'all' : grant.propertyIds.length,
          ],
        },
      })
    })

    return NextResponse.json({ success: true, message: 'Cập nhật quyền thành viên thành công' })
  } catch (error) {
    console.error('Update member error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi cập nhật quyền' }, { status: 500 })
  }
}

/**
 * DELETE — remove a member (members_manage, with the same limits as PATCH),
 * or leave the workspace: any member may remove their own row, even a
 * locked one. The owner cannot be removed.
 */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id, memberId } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const userId = session.user.id

    const member = await memberOf(id, memberId)
    const leaving = member?.userId === userId
    let access: Access | null = null
    if (!leaving) {
      const granted = await checkAccess(userId, id, 'members_manage')
      if (!granted.ok) return granted.response
      access = granted.access
    }
    if (!member) return NextResponse.json({ success: false, error: MEMBER_NOT_FOUND }, { status: 404 })
    if (member.workspace.ownerId === member.userId) {
      return NextResponse.json({ success: false, error: 'Không thể xóa chủ sở hữu khỏi workspace' }, { status: 400 })
    }
    if (access) {
      const refused = memberProblem(access, { ...member, propertyIds: member.properties.map((p) => p.propertyId) })
      if (refused) return NextResponse.json({ success: false, error: refused }, { status: 403 })
      const locked = await lockedResponse(id)
      if (locked) return locked
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.delete({ where: { id: member.id } })
      await logMemberActivity(tx, {
        workspaceId: id,
        actorId: userId,
        action: leaving ? 'MEMBER_LEFT' : 'MEMBER_REMOVED',
        entityType: 'MEMBER',
        entityId: member.id,
        subject: { email: member.user.email, name: member.user.name },
      })
    })
    // A freed seat may unlock someone locked for the plan.
    reconcileOverageSoon(id)

    return NextResponse.json({
      success: true,
      message: leaving ? 'Bạn đã rời khỏi workspace' : 'Đã xóa thành viên khỏi workspace',
    })
  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi xóa thành viên' }, { status: 500 })
  }
}
