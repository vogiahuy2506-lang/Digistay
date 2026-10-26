import { NextRequest, NextResponse } from 'next/server'
import { BlockType, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidatePublicSite, loadSiteProps } from '@/lib/public-site/site'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { lockedResponseForProperty } from '@/lib/billing/guard'

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
            { members: { some: { userId: session.user.id, planLockedAt: null } } },
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
      invalidatePublicSite(propertyId)
    }

    // What the site shows, for the builder's preview: the real rooms (priced
    // as on the site), photos, amenities, services and dishes. A site never
    // laid out shows the default layout (src/lib/public-site/site.ts); the
    // builder starts from those blocks instead of an empty page.
    const site = await loadSiteProps(propertyId)
    const preview = site && {
      property: site.property,
      images: site.images,
      amenities: site.amenities,
      roomTypes: site.roomTypes,
      services: site.services,
      menuItems: site.menuItems,
      defaultBlocks: blocks.length === 0 ? site.blocks : [],
    }

    return NextResponse.json({
      success: true,
      data: {
        blocks,
        settings,
        site: preview,
      },
    })
  } catch (error) {
    console.error('Get website data error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy dữ liệu website' }, { status: 500 })
  }
}

// A missing or non-string propertyId must never reach Prisma: `undefined`
// drops the condition and a filter object widens it, so the delete below
// once wiped every hotel's blocks.
const putSchema = z.object({
  propertyId: z.string().min(1),
  blocks: z
    .array(
      z.object({
        type: z.nativeEnum(BlockType),
        name: z.string().max(200),
        config: z.record(z.unknown()).optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .max(100)
    .default([]),
})

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const validation = putSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Dữ liệu website không hợp lệ' }, { status: 400 })
    }
    const { blocks } = validation.data

    // Check property access
    const property = await prisma.property.findFirst({
      where: {
        id: validation.data.propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, planLockedAt: null } } },
          ],
        },
      },
      select: { id: true, workspaceId: true },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }
    // Owners, ADMIN and MANAGER edit the site, like the custom domain and SSL
    // routes and the sidebar (receptionists and USER never see the builder).
    // Publishing decides whether guests see the site and can book.
    const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
    if (!access.ok) return access.response
    const locked = await lockedResponseForProperty(property.id)
    if (locked) return locked

    // One transaction: a failure keeps the current layout instead of none.
    await prisma.$transaction([
      prisma.websiteBlock.deleteMany({ where: { propertyId: property.id } }),
      prisma.websiteBlock.createMany({
        data: blocks.map((block, index) => ({
          propertyId: property.id,
          type: block.type,
          name: block.name,
          config: (block.config ?? {}) as Prisma.InputJsonObject,
          isEnabled: block.isEnabled ?? true,
          sortOrder: index,
        })),
      }),
      prisma.activityLog.create({
        data: {
          userId: session.user.id,
          propertyId: property.id,
          action: 'UPDATE',
          entityType: 'WEBSITE',
          entityId: property.id,
          changes: { blocksUpdated: true },
        },
      }),
    ])
    invalidatePublicSite(property.id)

    return NextResponse.json({
      success: true,
      message: 'Cập nhật website thành công',
    })
  } catch (error) {
    console.error('Update website error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật website' }, { status: 500 })
  }
}
