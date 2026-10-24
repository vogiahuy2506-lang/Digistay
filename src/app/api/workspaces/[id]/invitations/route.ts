import { NextRequest, NextResponse } from 'next/server'
import { queueWorkspaceInvite, sendAfterResponse } from '@/lib/email/outbox'
import { requestLocale } from '@/lib/i18n/request-locale'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { inviteMemberSchema } from '@/lib/validations'
import { generateRandomToken } from '@/lib/utils'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

// Check if user is workspace admin or owner
async function checkWorkspaceAdmin(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, role: 'ADMIN' } } },
      ],
    },
  })

  return !!workspace
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const isAdmin = await checkWorkspaceAdmin(id, session.user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem danh sách lời mời' },
        { status: 403 }
      )
    }

    const invitations = await prisma.invitation.findMany({
      where: { workspaceId: id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: invitations,
    })
  } catch (error) {
    console.error('Get invitations error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách lời mời' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const isAdmin = await checkWorkspaceAdmin(id, session.user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền mời thành viên' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validation = inviteMemberSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, role } = validation.data

    // Anyone can create a workspace and is its admin, so without a per-user
    // cap this route mails any address from Digistay's server, unlimited.
    const sent = await hit(LIMITS.invitationSendUser, session.user.id)
    if (!sent.allowed) {
      return tooManyRequests('Bạn đã gửi quá nhiều lời mời. Vui lòng thử lại sau.', sent.retryAfterSec)
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: id,
        user: { email },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: 'Người dùng này đã là thành viên của workspace' },
        { status: 400 }
      )
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        workspaceId: id,
        email,
        status: 'PENDING',
      },
    })

    if (existingInvitation) {
      return NextResponse.json(
        { success: false, error: 'Đã có lời mời đang chờ xử lý cho email này' },
        { status: 400 }
      )
    }

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    })

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        email,
        workspaceId: id,
        role,
        token: generateRandomToken(32),
        senderId: session.user.id,
        recipientId: invitedUser?.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: {
        workspace: { select: { name: true } },
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Queued, then sent after the response (src/lib/email/outbox.ts): a
    // failure is retried and alerted instead of lost.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    // URL shape: /invitations/[token] (the public accept page is
    // token-only; the workspace is looked up server-side from the token).
    const inviteUrl = `${siteUrl}/invitations/${invitation.token}`
    try {
      const emailId = await queueWorkspaceInvite(
        {
          recipientEmail: invitation.email,
          recipientName: invitation.recipient?.name ?? undefined,
          inviterName: invitation.sender.name ?? invitation.sender.email,
          workspaceName: invitation.workspace.name,
          role: invitation.role,
          inviteUrl,
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

    return NextResponse.json({
      success: true,
      data: invitation,
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
