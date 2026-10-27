import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkAccess, requireAccess } from '@/lib/auth/access'
import { generateRandomToken } from '@/lib/utils'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { lockedResponse, planResponse } from '@/lib/billing/guard'
import { grantProblem, inviteMemberSchema, toGrant } from '@/lib/members/grant'
import { inviteExpiry, sendInvitationEmail } from '@/lib/members/invitations'
import { logMemberActivity } from '@/lib/members/activity'
import { notifyInvitation } from '@/lib/notifications'

const PERSON = { select: { id: true, name: true, email: true, image: true } } as const

/** GET — the workspace's invitations, newest first (members_manage). */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const granted = await requireAccess(id, 'members_manage')
    if (!granted.ok) return granted.response

    // One past its date is shown as expired (and stops taking a seat), whether or not its link was opened.
    await prisma.invitation.updateMany({
      where: { workspaceId: id, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    })
    const invitations = await prisma.invitation.findMany({
      where: { workspaceId: id },
      include: { sender: PERSON, recipient: PERSON },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({
      success: true,
      data: invitations.map(({ token: _token, ...invitation }) => invitation),
    })
  } catch (error) {
    console.error('Get invitations error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách lời mời' },
      { status: 500 }
    )
  }
}

/**
 * POST { email, role, permissions?, allProperties?, propertyIds? } —
 * members_manage: invite by email with the access the member gets on
 * accepting, no more than the caller has (src/lib/members/grant.ts). An open
 * invitation takes a staff seat of the plan.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
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

    const validation = inviteMemberSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }
    const email = validation.data.email.trim().toLowerCase()

    const properties = await prisma.property.findMany({ where: { workspaceId: id }, select: { id: true } })
    const grant = toGrant(validation.data, properties.map((p) => p.id))
    if (typeof grant === 'string') return NextResponse.json({ success: false, error: grant }, { status: 400 })
    const tooWide = grantProblem(access, grant)
    if (tooWide) return NextResponse.json({ success: false, error: tooWide }, { status: 403 })

    // Anyone can create a workspace and is its admin, so without a per-user
    // cap this route mails any address from Digistay's server, unlimited.
    const sent = await hit(LIMITS.invitationSendUser, access.userId)
    if (!sent.allowed) {
      return tooManyRequests('Bạn đã gửi quá nhiều lời mời. Vui lòng thử lại sau.', sent.retryAfterSec)
    }

    const workspace = await prisma.workspace.findUnique({ where: { id }, select: { ownerId: true } })
    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: id, user: { email: { equals: email, mode: 'insensitive' } } },
    })
    const ownerEmail = workspace
      ? (await prisma.user.findUnique({ where: { id: workspace.ownerId }, select: { email: true } }))?.email
      : null
    if (existingMember || ownerEmail?.toLowerCase() === email) {
      return NextResponse.json(
        { success: false, error: 'Người dùng này đã là thành viên của workspace' },
        { status: 400 }
      )
    }

    // One still open: resend it instead (POST ./[invitationId]/resend).
    const now = new Date()
    const open = await prisma.invitation.findFirst({
      where: { workspaceId: id, email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expiresAt: { gt: now } },
    })
    if (open) {
      return NextResponse.json(
        { success: false, error: 'Đã có lời mời đang chờ xử lý cho email này' },
        { status: 400 }
      )
    }

    // An open invitation takes a staff seat of the plan (src/lib/billing).
    const overPlan = await planResponse(id, 'staff', 1)
    if (overPlan) return overPlan

    const invitedUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })

    const invitation = await prisma.$transaction(async (tx) => {
      // Those past their date are done with: one of them must not stand for this email any more.
      await tx.invitation.updateMany({
        where: { workspaceId: id, email: { equals: email, mode: 'insensitive' }, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      })
      const created = await tx.invitation.create({
        data: {
          email,
          workspaceId: id,
          role: grant.role,
          permissions: grant.permissions,
          customPermissions: grant.customPermissions,
          allProperties: grant.allProperties,
          propertyIds: grant.propertyIds,
          token: generateRandomToken(32),
          senderId: access.userId,
          recipientId: invitedUser?.id,
          expiresAt: inviteExpiry(now),
        },
        include: { sender: PERSON, recipient: PERSON },
      })
      await logMemberActivity(tx, {
        workspaceId: id,
        actorId: access.userId,
        action: 'MEMBER_INVITED',
        entityType: 'INVITATION',
        entityId: created.id,
        subject: { email },
        changes: { role: created.role, custom: created.customPermissions, properties: grant.allProperties ? 'all' : grant.propertyIds.length },
      })
      // In the bell too, for an invitee with an account.
      await notifyInvitation(tx, created.id)
      return created
    })

    // Queued, then sent after the response (src/lib/email/outbox.ts): a
    // failure is retried and alerted instead of lost.
    await sendInvitationEmail(invitation.id, request)

    const { token: _token, ...data } = invitation
    return NextResponse.json({
      success: true,
      data,
      message: `Đã gửi lời mời đến ${email}`,
    })
  } catch (error) {
    console.error('Create invitation error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi gửi lời mời' },
      { status: 500 }
    )
  }
}
