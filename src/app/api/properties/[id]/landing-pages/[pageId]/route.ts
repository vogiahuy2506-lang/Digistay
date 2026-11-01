import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { PageType, PageStatus } from '@prisma/client'
import { normalizeSlug } from '../route'
import { invalidatePublicSite } from '@/lib/public-site/site'

const updateSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(200).optional(),
  slug: z.string().trim().max(100).optional(),
  type: z.nativeEnum(PageType).optional(),
  status: z.nativeEnum(PageStatus).optional(),
  themeConfig: z.record(z.unknown()).optional(),
  metaTitle: z.string().trim().max(200).nullable().optional(),
  metaDescription: z.string().trim().max(500).nullable().optional(),
  ogImage: z.string().trim().nullable().optional(),
  trackingPixels: z.record(z.unknown()).nullable().optional(),
  blocks: z.array(z.record(z.unknown())).optional(),
})

/**
 * GET /api/properties/[id]/landing-pages/[pageId]
 * Lấy chi tiết một landing page.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const { id: propertyId, pageId } = await props.params
    const access = await checkPropertyAccess(session.user.id, propertyId, 'website_manage')
    if (!access.ok) return access.response

    const page = await prisma.landingPage.findFirst({
      where: { id: pageId, propertyId, deletedAt: null },
    })

    if (!page) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy landing page' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('[API landing-pages/[pageId] GET error]:', error)
    return NextResponse.json({ success: false, error: 'Lỗi tải chi tiết landing page' }, { status: 500 })
  }
}

/**
 * PUT /api/properties/[id]/landing-pages/[pageId]
 * Cập nhật cấu hình và nội dung landing page.
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const { id: propertyId, pageId } = await props.params
    const access = await checkPropertyAccess(session.user.id, propertyId, 'website_manage')
    if (!access.ok) return access.response

    const existing = await prisma.landingPage.findFirst({
      where: { id: pageId, propertyId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy landing page' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 }
      )
    }

    const data = parsed.data
    let updatedSlug = existing.slug

    if (data.slug && data.slug.trim() !== existing.slug) {
      const normalized = normalizeSlug(data.slug.trim())
      if (!normalized) {
        return NextResponse.json({ success: false, error: 'Đường dẫn (slug) không hợp lệ' }, { status: 400 })
      }
      const duplicate = await prisma.landingPage.findFirst({
        where: {
          propertyId,
          slug: normalized,
          deletedAt: null,
          NOT: { id: pageId },
        },
        select: { id: true },
      })
      if (duplicate) {
        return NextResponse.json({ success: false, error: 'Đường dẫn này đã được sử dụng cho một trang khác' }, { status: 409 })
      }
      updatedSlug = normalized
    }

    const wasPublished = existing.status === PageStatus.PUBLISHED
    const isNowPublished = data.status === PageStatus.PUBLISHED || (data.status === undefined && wasPublished)
    const publishedAt = isNowPublished && !existing.publishedAt ? new Date() : existing.publishedAt

    const updated = await prisma.landingPage.update({
      where: { id: pageId },
      data: {
        ...(data.title ? { title: data.title } : {}),
        slug: updatedSlug,
        ...(data.type ? { type: data.type } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.themeConfig ? { themeConfig: data.themeConfig as any } : {}),
        ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle } : {}),
        ...(data.metaDescription !== undefined ? { metaDescription: data.metaDescription } : {}),
        ...(data.ogImage !== undefined ? { ogImage: data.ogImage } : {}),
        ...(data.trackingPixels !== undefined ? { trackingPixels: data.trackingPixels as any } : {}),
        ...(data.blocks ? { blocks: data.blocks as any } : {}),
        publishedAt,
      },
    })

    // Xoá cache public site nếu trang được xuất bản
    invalidatePublicSite(propertyId)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[API landing-pages/[pageId] PUT error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể cập nhật landing page' }, { status: 500 })
  }
}

/**
 * DELETE /api/properties/[id]/landing-pages/[pageId]
 * Xoá mềm landing page.
 */
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const { id: propertyId, pageId } = await props.params
    const access = await checkPropertyAccess(session.user.id, propertyId, 'website_manage')
    if (!access.ok) return access.response

    const existing = await prisma.landingPage.findFirst({
      where: { id: pageId, propertyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy landing page' }, { status: 404 })
    }

    await prisma.landingPage.update({
      where: { id: pageId },
      data: { deletedAt: new Date() },
    })

    invalidatePublicSite(propertyId)

    return NextResponse.json({ success: true, message: 'Đã xoá landing page' })
  } catch (error) {
    console.error('[API landing-pages/[pageId] DELETE error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể xoá landing page' }, { status: 500 })
  }
}

