import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { accessibleProperties, checkPropertyAccess } from '@/lib/auth/access'
import { badParam, enumParam, pageParams, paginationOf, searchParam } from '@/lib/api/list-params'
import { blogPostInputSchema, finishPostSlug } from '@/lib/marketing/blog'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { Prisma } from '@prisma/client'

/** GET — list blog posts of a property (soft-deleted hidden). */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const ok = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true },
    })
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 })
    }

    const search = new URL(request.url).searchParams
    const { page, limit, skip } = pageParams(search)
    const q = searchParam(search)
    const statusRaw = enumParam(search.get('status'), ['published', 'draft', 'all'] as const)
    if (statusRaw === null) return badParam('Trạng thái không hợp lệ')
    const status = statusRaw ?? 'all'

    const where: Prisma.BlogPostWhereInput = {
      propertyId: params.id,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { summary: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(status === 'published' ? { isPublished: true } : status === 'draft' ? { isPublished: false } : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: [{ isPublished: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ])

    return NextResponse.json({ success: true, data: rows, pagination: paginationOf(page, limit, total) })
  } catch (error) {
    console.error('List blog posts error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách bài viết' }, { status: 500 })
  }
}

/** POST — create a blog post. property_edit. */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const access = await checkPropertyAccess(session.user.id, params.id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response
    const locked = await lockedResponseForProperty(params.id)
    if (locked) return locked

    const parsed = blogPostInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }

    const input = parsed.data
    const slug = finishPostSlug(input.slug)
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Đường dẫn (slug) không hợp lệ' }, { status: 400 })
    }

    const dup = await prisma.blogPost.findFirst({
      where: { propertyId: params.id, slug, deletedAt: null },
      select: { id: true },
    })
    if (dup) {
      return NextResponse.json({ success: false, error: 'Đường dẫn bài viết đã tồn tại trong cơ sở này' }, { status: 409 })
    }

    const publishedAt = input.isPublished ? (input.publishedAt ?? new Date()) : null

    const post = await prisma.blogPost.create({
      data: {
        propertyId: params.id,
        title: input.title,
        slug,
        summary: input.summary ?? null,
        content: input.content,
        coverImage: input.coverImage ?? null,
        isPublished: input.isPublished,
        publishedAt,
        authorName: input.authorName ?? null,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
      },
    })

    invalidatePublicSite(params.id)

    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (error) {
    console.error('Create blog post error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo bài viết' }, { status: 500 })
  }
}
