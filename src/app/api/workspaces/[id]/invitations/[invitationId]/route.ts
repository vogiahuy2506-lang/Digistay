import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAccess } from '@/lib/auth/access'
import { logMemberActivity } from '@/lib/members/activity'

type Props = { params: Promise<{ id: string; invitationId: string }> }

/**
 * DELETE — members_manage: cancel an invitation not answered yet. Its link
 * stops working at once and its staff seat is free.
 */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id, invitationId } = await props.params
  try {
    const granted = await requireAccess(id, 'members_manage')
    if (!granted.ok) return granted.response

    const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, workspaceId: id } })
    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Lời mời không tồn tại' }, { status: 404 })
    }
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Lời mời đã được xử lý' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'REVOKED' } })
      await logMemberActivity(tx, {
        workspaceId: id,
        actorId: granted.userId,
        action: 'INVITE_REVOKED',
        entityType: 'INVITATION',
        entityId: invitation.id,
        subject: { email: invitation.email },
      })
    })
    return NextResponse.json({ success: true, message: 'Đã huỷ lời mời' })
  } catch (error) {
    console.error('Revoke invitation error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi huỷ lời mời' }, { status: 500 })
  }
}
