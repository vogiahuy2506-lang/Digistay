import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * GET /api/website/settings?propertyId=xxx
 * Lấy website settings cho một property
 */
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

    // Get or create settings
    let settings = await prisma.websiteSettings.findUnique({
      where: { propertyId },
    })

    if (!settings) {
      settings = await prisma.websiteSettings.create({
        data: { propertyId },
      })
    }

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Get website settings error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy cài đặt website' }, { status: 500 })
  }
}

/**
 * PUT /api/website/settings
 * Cập nhật website settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()
    const { propertyId, settings } = body

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

    // Update or create settings
    const updatedSettings = await prisma.websiteSettings.upsert({
      where: { propertyId },
      update: {
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        fontFamily: settings.fontFamily,
        headingFont: settings.headingFont,
        layout: settings.layout,
        metaTitle: settings.metaTitle,
        metaDescription: settings.metaDescription,
        customDomain: settings.customDomain,
        isPublished: settings.isPublished,
        publishedAt: settings.isPublished ? new Date() : null,
      },
      create: {
        propertyId,
        primaryColor: settings.primaryColor || '#3B82F6',
        secondaryColor: settings.secondaryColor || '#10B981',
        accentColor: settings.accentColor || '#F59E0B',
        fontFamily: settings.fontFamily || 'Inter',
        headingFont: settings.headingFont || 'Playfair Display',
        layout: settings.layout || 'modern',
        metaTitle: settings.metaTitle,
        metaDescription: settings.metaDescription,
        customDomain: settings.customDomain,
        isPublished: settings.isPublished || false,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId,
        action: settings.isPublished ? 'PUBLISH' : 'UPDATE',
        entityType: 'WEBSITE_SETTINGS',
        entityId: updatedSettings.id,
        changes: { isPublished: settings.isPublished },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: settings.isPublished ? 'Website đã được xuất bản' : 'Cập nhật cài đặt thành công',
    })
  } catch (error) {
    console.error('Update website settings error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật cài đặt' }, { status: 500 })
  }
}
