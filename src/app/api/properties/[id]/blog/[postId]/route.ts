import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { accessibleProperties, checkPropertyAccess } from '@/lib/auth/access'
import { blogPostInputSchema, finishPostSlug } from '@/lib/marketing/blog'
import { invalidatePublicSite } from '@/lib/public-site/site'

/** GET — get one blog post. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string; postId: string }> }) {
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

    const post = await prisma.blogPost.findFirst({
      where: { id: params.postId, propertyId: params.id, deletedAt: null },
    })
    if (!post) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy bài viết' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    console.error('Get blog post error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tải bài viết' }, { status: 500 })
  }
}

/** PATCH — update one blog post. */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string; postId: string }> }) {
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

    const existing = await prisma.blogPost.findFirst({
      where: { id: params.postId, propertyId: params.id, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy bài viết' }, { status: 404 })
    }

    const parsed = blogPostInputSchema.partial().safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }

    const input = parsed.data
    let nextSlug = existing.slug
    if (input.slug !== undefined) {
      const cleaned = finishPostSlug(input.slug)
      if (!cleaned) {
        return NextResponse.json({ success: false, error: 'Đường dẫn (slug) không hợp lệ' }, { status: 400 })
      }
      if (cleaned !== existing.slug) {
        const dup = await prisma.blogPost.findFirst({
          where: { propertyId: params.id, slug: cleaned, deletedAt: null, NOT: { id: params.postId } },
          select: { id: true },
        })
        if (dup) {
          return NextResponse.json({ success: false, error: 'Đường dẫn bài viết đã tồn tại' }, { status: 409 })
        }
        nextSlug = cleaned
      }
    }

    let publishedAt = existing.publishedAt
    if (input.isPublished !== undefined) {
      if (input.isPublished && !existing.isPublished) {
        publishedAt = input.publishedAt ?? existing.publishedAt ?? new Date()
      } else if (!input.isPublished) {
        publishedAt = null
      }
    }

    const updated = await prisma.blogPost.update({
      where: { id: params.postId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        slug: nextSlug,
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        publishedAt,
        ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
        ...(input.metaTitle !== undefined ? { metaTitle: input.metaTitle } : {}),
        ...(input.metaDescription !== undefined ? { metaDescription: input.metaDescription } : {}),
      },
    })

    invalidatePublicSite(params.id)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update blog post error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật bài viết' }, { status: 500 })
  }
}

/** DELETE — soft-delete one blog post. */
export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string; postId: string }> }) {
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

    const existing = await prisma.blogPost.findFirst({
      where: { id: params.postId, propertyId: params.id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy bài viết' }, { status: 404 })
    }

    await prisma.blogPost.update({
      where: { id: params.postId },
      data: { deletedAt: new Date() },
    })

    invalidatePublicSite(params.id)

    return NextResponse.json({ success: true, message: 'Đã xóa bài viết' })
  } catch (error) {
    console.error('Delete blog post error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa bài viết' }, { status: 500 })
  }
}
