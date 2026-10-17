import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { createPolicySchema, updatePolicySchema } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const property = await prisma.property.findFirst({
      where: {
        id,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
      select: { id: true },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập' },
        { status: 403 }
      )
    }

    const policy = await prisma.policy.findUnique({
      where: { propertyId: id },
    })

    if (!policy) {
      // Create default policy if not exists
      const defaultPolicy = await prisma.policy.create({
        data: { propertyId: id },
      })
      return NextResponse.json({
        success: true,
        data: defaultPolicy,
      })
    }

    return NextResponse.json({
      success: true,
      data: policy,
    })
  } catch (error) {
    console.error('Get policy error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy chính sách' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Verify admin access
    const property = await prisma.property.findFirst({
      where: {
        id,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, role: 'ADMIN' } } },
          ],
        },
      },
      include: {
        workspace: {
          select: { id: true },
        },
      },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền cập nhật chính sách' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = updatePolicySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Update or create policy
    const policy = await prisma.policy.upsert({
      where: { propertyId: id },
      create: { propertyId: id, ...validation.data },
      update: validation.data,
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.workspace.id,
        propertyId: id,
        action: 'UPDATE',
        entityType: 'POLICY',
        entityId: policy.id,
        changes: validation.data,
      },
    })

    return NextResponse.json({
      success: true,
      data: policy,
      message: 'Cập nhật chính sách thành công',
    })
  } catch (error) {
    console.error('Update policy error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật chính sách' },
      { status: 500 }
    )
  }
}
