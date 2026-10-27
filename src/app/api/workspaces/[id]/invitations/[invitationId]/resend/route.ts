import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAccess } from '@/lib/auth/access'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { lockedResponse, planResponse } from '@/lib/billing/guard'
import { inviteExpiry, sendInvitationEmail } from '@/lib/members/invitations'
import { logMemberActivity } from '@/lib/members/activity'
import { notifyInvitation } from '@/lib/notifications'

type Props = { params: Promise<{ id: string; invitationId: string }> }

/**
 * POST — members_manage: send an invitation's email again, its link valid
 * for another 7 days. One that expired opens again, taking a staff seat;
 * one accepted, declined or cancelled is done with (invite anew instead).
 */
export async function POST(request: NextRequest, props: Props) {
  const { id, invitationId } = await props.params
  try {
    const granted = await requireAccess(id, 'members_manage')
    if (!granted.ok) return granted.response
    const locked = await lockedResponse(id)
    if (locked) return locked

    const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, workspaceId: id } })
    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Lời mời không tồn tại' }, { status: 404 })
    }
    const now = new Date()
    const open = invitation.status === 'PENDING' && invitation.expiresAt > now
    if (!open && invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED') {
      return NextResponse.json({ success: false, error: 'Lời mời đã được xử lý' }, { status: 400 })
    }

    const sent = await hit(LIMITS.invitationSendUser, granted.userId)
    if (!sent.allowed) {
      return tooManyRequests('Bạn đã gửi quá nhiều lời mời. Vui lòng thử lại sau.', sent.retryAfterSec)
    }
    if (!open) {
      // Reopened, it takes a seat again; and the email may have joined meanwhile.
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: id, user: { email: { equals: invitation.email, mode: 'insensitive' } } },
        select: { id: true },
      })
      if (member) {
        return NextResponse.json({ success: false, error: 'Người dùng này đã là thành viên của workspace' }, { status: 400 })
      }
      const newer = await prisma.invitation.findFirst({
        where: { workspaceId: id, email: invitation.email, status: 'PENDING', expiresAt: { gt: now }, NOT: { id: invitation.id } },
        select: { id: true },
      })
      if (newer) {
        return NextResponse.json({ success: false, error: 'Đã có lời mời đang chờ xử lý cho email này' }, { status: 400 })
      }
      const overPlan = await planResponse(id, 'staff', 1)
      if (overPlan) return overPlan
    }

    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'PENDING', expiresAt: inviteExpiry(now) } })
      await logMemberActivity(tx, {
        workspaceId: id,
        actorId: granted.userId,
        action: 'INVITE_RESENT',
        entityType: 'INVITATION',
        entityId: invitation.id,
        subject: { email: invitation.email },
      })
      await notifyInvitation(tx, invitation.id)
    })
    await sendInvitationEmail(invitation.id, request)

    return NextResponse.json({ success: true, message: `Đã gửi lại lời mời đến ${invitation.email}` })
  } catch (error) {
    console.error('Resend invitation error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi gửi lời mời' }, { status: 500 })
  }
}
