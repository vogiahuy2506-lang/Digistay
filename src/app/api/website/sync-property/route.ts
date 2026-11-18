import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkPropertyAccess, can } from '@/lib/auth/access'
import { invalidatePublicSite, loadSiteProps } from '@/lib/public-site/site'

const schema = z.object({
  propertyId: z.string().min(1, 'Thiếu propertyId'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ' }, { status: 400 })
    }

    const { propertyId } = parsed.data
    const granted = await checkPropertyAccess(session.user.id, propertyId, null)
    if (!granted.ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }
    if (!can(granted.access, 'website_manage', granted.property.id)) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const site = await loadSiteProps(propertyId)
    if (!site) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở lưu trú' }, { status: 404 })
    }

    const photos = site.images.map((m) => m.url)
    const coverPhoto = photos[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=80'

    // Update Hero block if exists
    const heroBlock = await prisma.websiteBlock.findFirst({
      where: { propertyId, type: 'HERO' },
    })
    if (heroBlock) {
      const cfg = (heroBlock.config as Record<string, any>) || {}
      await prisma.websiteBlock.update({
        where: { id: heroBlock.id },
        data: {
          config: {
            ...cfg,
            heroImage: cfg.heroImage || coverPhoto,
          },
        },
      })
    }

    // Update Gallery block photos
    const galleryBlock = await prisma.websiteBlock.findFirst({
      where: { propertyId, type: 'GALLERY' },
    })
    if (galleryBlock && photos.length > 0) {
      const cfg = (galleryBlock.config as Record<string, any>) || {}
      await prisma.websiteBlock.update({
        where: { id: galleryBlock.id },
        data: {
          config: {
            ...cfg,
            images: photos.slice(0, 12),
          },
        },
      })
    }

    invalidatePublicSite(propertyId)

    const blocks = await prisma.websiteBlock.findMany({
      where: { propertyId },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      message: 'Đồng bộ dữ liệu cơ sở thành công',
      data: { blocks },
    })
  } catch (error) {
    console.error('[API sync-property] Error:', error)
    return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ' }, { status: 500 })
  }
}
