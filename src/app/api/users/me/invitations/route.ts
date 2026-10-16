import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Get pending invitations for current user
    const invitations = await prisma.invitation.findMany({
      where: {
        email: session.user.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        sender: {
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
      count: invitations.length,
    })
  } catch (error) {
    console.error('Get pending invitations error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách lời mời' },
      { status: 500 }
    )
  }
}
