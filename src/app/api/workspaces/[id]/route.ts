import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { updateWorkspaceSchema, validationMessage } from '@/lib/validations'
import { lockedResponse } from '@/lib/billing/guard'

// Helper function to check workspace access
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, planLockedAt: null } } },
      ],
    },
    include: {
      owner: { select: { id: true } },
      members: { where: { userId, planLockedAt: null }, select: { role: true } },
    },
  })

  if (!workspace) {
    return { hasAccess: false, isAdmin: false, isOwner: false, isManager: false }
  }

  const isOwner = workspace.ownerId === userId
  const memberRole = workspace.members[0]?.role
  
  // ADMIN = chủ sở hữu (toàn quyền)
  // MANAGER = quản lý (quản lý property, members)
  // RECEPTIONIST = lễ tân (hạn chế)
  // USER = người dùng thường (xem)
  const isAdmin = isOwner || memberRole === 'ADMIN'
  const isManager = memberRole === 'MANAGER' || isAdmin
  const isReceptionist = memberRole === 'RECEPTIONIST' || isManager

  return { hasAccess: true, isAdmin, isOwner, isManager, isReceptionist }
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

    const access = await checkWorkspaceAccess(id, session.user.id)
    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập workspace này' },
        { status: 403 }
      )
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
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
        },
        properties: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
            subdomain: true,
          },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy workspace' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: workspace,
    })
  } catch (error) {
    console.error('Get workspace error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy thông tin workspace' },
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

    const access = await checkWorkspaceAccess(id, session.user.id)
    if (!access.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa workspace này' },
        { status: 403 }
      )
    }
    const locked = await lockedResponse(id)
    if (locked) return locked

    const body = await request.json()
    
    // Validate input
    const validation = updateWorkspaceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validationMessage(validation.error) },
        { status: 400 }
      )
    }

    const { name, description, domain, logo, businessType, currency, timezone } = validation.data

    // Business type, currency and timezone live in the settings JSON (as POST
    // /api/workspaces stores them); the other keys there are kept.
    const settingsChange = Object.fromEntries(
      Object.entries({ businessType, currency, timezone }).filter(([, value]) => value)
    )
    let settings: Prisma.InputJsonObject | undefined
    if (Object.keys(settingsChange).length > 0) {
      const current = await prisma.workspace.findUnique({ where: { id }, select: { settings: true } })
      const saved = current?.settings && typeof current.settings === 'object' && !Array.isArray(current.settings)
        ? (current.settings as Prisma.InputJsonObject)
        : {}
      settings = { ...saved, ...settingsChange }
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(domain !== undefined && { domain: domain || null }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(settings && { settings }),
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
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
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: workspace,
      message: 'Cập nhật workspace thành công',
    })
  } catch (error) {
    console.error('Update workspace error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật workspace' },
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

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy workspace' },
        { status: 404 }
      )
    }

    // Only owner can delete workspace
    if (workspace.ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Chỉ chủ sở hữu mới có thể xóa workspace' },
        { status: 403 }
      )
    }

    await prisma.workspace.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa workspace thành công',
    })
  } catch (error) {
    console.error('Delete workspace error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa workspace' },
      { status: 500 }
    )
  }
}
