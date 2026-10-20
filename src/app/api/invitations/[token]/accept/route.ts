import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * POST /api/invitations/[token]/accept
 *
 * Accept an invitation by token. The session email must match the
 * invitation's email. On success, the user is added as a member of the
 * workspace with the invitation's role and the invitation is marked
 * ACCEPTED.
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
        workspace: { select: { id: true, name: true } },
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

    // Add user to workspace, then mark invitation as accepted. Wrapped in
    // a transaction so we don't end up with a half-accepted invite.
    const workspaceId = invitation.workspaceId
    await prisma.$transaction([
      prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: session.user.id,
          },
        },
        update: { role: invitation.role },
        create: {
          workspaceId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          recipientId: session.user.id,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        workspaceSlug: invitation.workspace.id,
        workspaceName: invitation.workspace.name,
      },
      message: 'Chấp nhận lời mời thành công',
    })
  } catch (error) {
    console.error('Accept invitation error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi chấp nhận lời mời' },
      { status: 500 }
    )
  }
}
