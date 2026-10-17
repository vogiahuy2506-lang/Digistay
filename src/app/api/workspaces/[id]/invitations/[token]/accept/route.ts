import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; token: string } }
) {
  try {
    const { id, token } = params

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Lời mời không hợp lệ' },
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
        { status: 400 }
      )
    }

    if (invitation.workspaceId !== id) {
      return NextResponse.json(
        { success: false, error: 'Lời mời không thuộc workspace này' },
        { status: 400 }
      )
    }

    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập để chấp nhận lời mời' },
        { status: 401 }
      )
    }

    // Verify email matches
    if (session.user.email !== invitation.email) {
      return NextResponse.json(
        { success: false, error: 'Email không khớp với lời mời' },
        { status: 403 }
      )
    }

    // Add user to workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId: id,
        userId: session.user.id,
        role: invitation.role,
      },
    })

    // Update invitation status
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        recipientId: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: { workspaceId: id },
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
