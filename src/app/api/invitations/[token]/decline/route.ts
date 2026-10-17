import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * POST /api/invitations/[token]/decline
 *
 * Decline a pending invitation. Requires a session whose email matches
 * the invitation's email.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const session = await auth()

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập để từ chối lời mời' },
        { status: 401 }
      )
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
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

    if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Email không khớp với lời mời' },
        { status: 403 }
      )
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'DECLINED',
        recipientId: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Đã từ chối lời mời',
    })
  } catch (error) {
    console.error('Decline invitation error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi từ chối lời mời' },
      { status: 500 }
    )
  }
}
