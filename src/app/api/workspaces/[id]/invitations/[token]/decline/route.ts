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

    if (invitation.workspaceId !== id) {
      return NextResponse.json(
        { success: false, error: 'Lời mời không thuộc workspace này' },
        { status: 400 }
      )
    }

    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
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

    // Update invitation status to declined
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED' },
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
