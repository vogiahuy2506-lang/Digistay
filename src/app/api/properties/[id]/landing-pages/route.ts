import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { PageType, PageStatus } from '@prisma/client'

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const createSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(200),
  slug: z.string().trim().max(100).optional(),
  type: z.nativeEnum(PageType).optional().default(PageType.CAMPAIGN_LP),
  status: z.nativeEnum(PageStatus).optional().default(PageStatus.DRAFT),
  themeConfig: z.record(z.unknown()).optional().default({}),
  metaTitle: z.string().trim().max(200).nullable().optional(),
  metaDescription: z.string().trim().max(500).nullable().optional(),
  ogImage: z.string().trim().nullable().optional(),
  trackingPixels: z.record(z.unknown()).nullable().optional(),
  blocks: z.array(z.record(z.unknown())).optional().default([]),
})

/**
 * GET /api/properties/[id]/landing-pages
 * Danh sách các landing page của cơ sở.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const { id: propertyId } = await props.params
    const access = await checkPropertyAccess(session.user.id, propertyId, 'website_manage')
    if (!access.ok) return access.response

    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const typeParam = url.searchParams.get('type')

    const pages = await prisma.landingPage.findMany({
      where: {
        propertyId,
        deletedAt: null,
        ...(statusParam && Object.values(PageStatus).includes(statusParam as PageStatus)
          ? { status: statusParam as PageStatus }
          : {}),
        ...(typeParam && Object.values(PageType).includes(typeParam as PageType)
          ? { type: typeParam as PageType }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        metaTitle: true,
        metaDescription: true,
        ogImage: true,
        viewCount: true,
        leadCount: true,
        bookingCount: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: pages })
  } catch (error) {
    console.error('[API landing-pages GET error]:', error)
    return NextResponse.json({ success: false, error: 'Lỗi tải danh sách landing page' }, { status: 500 })
  }
}

/**
 * POST /api/properties/[id]/landing-pages
 * Tạo mới landing page cho cơ sở.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const { id: propertyId } = await props.params
    const access = await checkPropertyAccess(session.user.id, propertyId, 'website_manage')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 }
      )
    }

    const data = parsed.data
    const baseSlug = normalizeSlug(data.slug?.trim() ? data.slug : data.title)
    if (!baseSlug) {
      return NextResponse.json({ success: false, error: 'Đường dẫn (slug) không hợp lệ' }, { status: 400 })
    }

    // Đảm bảo slug là duy nhất trong cơ sở
    let finalSlug = baseSlug
    let counter = 1
    while (true) {
      const exists = await prisma.landingPage.findFirst({
        where: { propertyId, slug: finalSlug, deletedAt: null },
        select: { id: true },
      })
      if (!exists) break
      finalSlug = `${baseSlug}-${counter}`
      counter++
    }

    const newPage = await prisma.landingPage.create({
      data: {
        propertyId,
        title: data.title,
        slug: finalSlug,
        type: data.type,
        status: data.status,
        themeConfig: data.themeConfig as any,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
        ogImage: data.ogImage ?? null,
        trackingPixels: (data.trackingPixels as any) ?? null,
        blocks: data.blocks as any,
        publishedAt: data.status === PageStatus.PUBLISHED ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true, data: newPage }, { status: 201 })
  } catch (error) {
    console.error('[API landing-pages POST error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể tạo landing page' }, { status: 500 })
  }
}

