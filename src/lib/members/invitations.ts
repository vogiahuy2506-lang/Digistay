/**
 * Invitations to a workspace: the email with its link, and turning an
 * accepted one into a membership with the access the admin chose
 * (src/lib/members/grant.ts).
 */
import type { NextRequest } from 'next/server'
import type { Invitation, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { queueWorkspaceInvite, sendAfterResponse } from '@/lib/email/outbox'
import { requestLocale } from '@/lib/i18n/request-locale'
import { clearInvitationNotices } from '@/lib/notifications'
import { logMemberActivity } from './activity'

export const INVITE_DAYS = 7
export const inviteExpiry = (now = new Date()) => new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000)

/** Queue the invitation's email, sent after the response; a failure is logged, never thrown. */
export async function sendInvitationEmail(invitationId: string, request: NextRequest) {
  try {
    const invitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: invitationId },
      include: {
        workspace: { select: { name: true } },
        sender: { select: { name: true, email: true } },
      },
    })
    // Sign in to accept, or create an account first: the email says which.
    const account = await prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: 'insensitive' } },
      select: { name: true },
    })
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    // The public accept page is token-only; the workspace is looked up from the token.
    const emailId = await queueWorkspaceInvite(
      {
        recipientEmail: invitation.email,
        recipientName: account?.name ?? undefined,
        hasAccount: !!account,
        inviterName: invitation.sender.name ?? invitation.sender.email,
        workspaceName: invitation.workspace.name,
        role: invitation.role,
        inviteUrl: `${siteUrl}/invitations/${invitation.token}`,
        expiresAt: invitation.expiresAt,
        // The inviter's language: the page they sent it from.
        locale: requestLocale(request),
      },
      invitation.id
    )
    sendAfterResponse([emailId])
  } catch (err) {
    console.error('[invitation] could not queue the email:', err)
  }
}

/** The invitation was answered (or cancelled) meanwhile. */
export class InvitationAnsweredError extends Error {}

/**
 * Make `userId` a member with the invitation's access and mark it accepted,
 * in `tx` (InvitationAnsweredError when it is no longer open). Properties
 * deleted since the invitation are skipped; if none is left of a limited
 * invitation, the member gets no property (an admin picks again).
 */
export async function joinFromInvitation(tx: Prisma.TransactionClient, invitation: Invitation, user: { id: string; email: string; name: string | null }) {
  const workspaceId = invitation.workspaceId
  // Claimed first: of two answers at once, one wins.
  const claimed = await tx.invitation.updateMany({
    where: { id: invitation.id, status: 'PENDING' },
    data: { status: 'ACCEPTED', recipientId: user.id },
  })
  if (claimed.count === 0) throw new InvitationAnsweredError()
  await clearInvitationNotices(tx, invitation.id)
  const access = {
    role: invitation.role,
    permissions: invitation.permissions,
    customPermissions: invitation.customPermissions,
    allProperties: invitation.allProperties,
  }
  const member = await tx.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    update: { ...access, disabledAt: null },
    create: { workspaceId, userId: user.id, ...access },
  })
  await tx.memberProperty.deleteMany({ where: { memberId: member.id } })
  if (!invitation.allProperties && invitation.propertyIds.length) {
    const live = await tx.property.findMany({ where: { workspaceId, id: { in: invitation.propertyIds } }, select: { id: true } })
    await tx.memberProperty.createMany({ data: live.map((p) => ({ memberId: member.id, propertyId: p.id })) })
  }
  await logMemberActivity(tx, {
    workspaceId,
    actorId: user.id,
    action: 'INVITE_ACCEPTED',
    entityType: 'INVITATION',
    entityId: invitation.id,
    subject: { email: user.email, name: user.name },
  })
  return member
}
