import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    // Check property access
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    // Get website blocks
    const blocks = await prisma.websiteBlock.findMany({
      where: { propertyId },
      orderBy: { sortOrder: 'asc' },
    })

    // Get or create website settings
    let settings = await prisma.websiteSettings.findUnique({
      where: { propertyId },
    })

    if (!settings) {
      settings = await prisma.websiteSettings.create({
        data: {
          propertyId,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        blocks,
        settings,
      },
    })
  } catch (error) {
    console.error('Get website data error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy dữ liệu website' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()
    const { propertyId, blocks } = body

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Check property access
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }

    // Delete existing blocks
    await prisma.websiteBlock.deleteMany({
      where: { propertyId },
    })

    // Create new blocks
    if (blocks && blocks.length > 0) {
      await prisma.websiteBlock.createMany({
        data: blocks.map((block: any, index: number) => ({
          propertyId,
          type: block.type,
          name: block.name,
          config: block.config || {},
          isEnabled: block.isEnabled ?? true,
          sortOrder: index,
        })),
      })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId,
        action: 'UPDATE',
        entityType: 'WEBSITE',
        entityId: propertyId,
        changes: { blocksUpdated: true },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Cập nhật website thành công',
    })
  } catch (error) {
    console.error('Update website error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật website' }, { status: 500 })
  }
}
