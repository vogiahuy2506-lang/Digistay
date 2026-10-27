import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { InvitationAnsweredError, joinFromInvitation } from '@/lib/members/invitations'

/**
 * POST /api/invitations/[token]/accept
 *
 * Accept an invitation by token. The session email must match the
 * invitation's email. On success, the user is added as a member of the
 * workspace with the invitation's access (role, permissions, properties)
 * and the invitation is marked ACCEPTED. An invitee without an account
 * signs up and accepts in one go: POST ../register.
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params
  try {
    const { token } = params
    const session = await auth()

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập để chấp nhận lời mời' },
        { status: 401 }
      )
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Lời mời không tồn tại' },
        { status: 404 }
      )
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Lời mời đã được xử lý' },
        { status: 400 }
      )
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json(
        { success: false, error: 'Lời mời đã hết hạn' },
        { status: 410 }
      )
    }

    if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email đăng nhập không khớp với email được mời',
        },
        { status: 403 }
      )
    }

    // The membership with the access the admin chose, and the invitation
    // accepted, together: never a half-accepted invite.
    const userId = session.user.id
    const user = { id: userId, email: session.user.email, name: session.user.name ?? null }
    await prisma.$transaction((tx) => joinFromInvitation(tx, invitation, user))

    return NextResponse.json({
      success: true,
      data: {
        workspaceId: invitation.workspaceId,
        workspaceSlug: invitation.workspace.slug,
        workspaceName: invitation.workspace.name,
      },
      message: 'Chấp nhận lời mời thành công',
    })
  } catch (error) {
    if (error instanceof InvitationAnsweredError) {
      return NextResponse.json({ success: false, error: 'Lời mời đã được xử lý' }, { status: 400 })
    }
    console.error('Accept invitation error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi chấp nhận lời mời' },
      { status: 500 }
    )
  }
}
