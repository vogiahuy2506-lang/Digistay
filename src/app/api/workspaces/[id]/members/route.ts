import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

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

    const access = await checkWorkspaceAdmin(id, session.user.id)
    if (!access) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem danh sách thành viên' },
        { status: 403 }
      )
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    // Get workspace owner
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    const membersWithOwnerStatus = members.map((member) => ({
      ...member,
      isOwner: member.userId === workspace?.ownerId,
    }))

    return NextResponse.json({
      success: true,
      data: membersWithOwnerStatus,
    })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách thành viên' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
        { success: false, error: 'Bạn không có quyền thay đổi quyền thành viên' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { memberId, role } = body

    if (!memberId || !role) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp đầy đủ thông tin' },
        { status: 400 }
      )
    }

    // Cannot change owner role
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (workspace?.ownerId === memberId) {
      return NextResponse.json(
        { success: false, error: 'Không thể thay đổi quyền của chủ sở hữu' },
        { status: 400 }
      )
    }

    await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
    })

    return NextResponse.json({
      success: true,
      message: 'Cập nhật quyền thành viên thành công',
    })
  } catch (error) {
    console.error('Update member role error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật quyền' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
        { success: false, error: 'Bạn không có quyền xóa thành viên' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp ID thành viên' },
        { status: 400 }
      )
    }

    // Cannot remove owner
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
      select: { userId: true },
    })

    if (workspace?.ownerId === member?.userId) {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa chủ sở hữu khỏi workspace' },
        { status: 400 }
      )
    }

    // Cannot remove yourself if you're not the owner
    if (member?.userId === session.user.id) {
      const isOwner = workspace?.ownerId === session.user.id
      if (!isOwner) {
        // Allow user to leave workspace
        await prisma.workspaceMember.delete({
          where: { id: memberId },
        })
        return NextResponse.json({
          success: true,
          message: 'Bạn đã rời khỏi workspace',
        })
      }
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json({
      success: true,
      message: 'Đã xóa thành viên khỏi workspace',
    })
  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa thành viên' },
      { status: 500 }
    )
  }
}
