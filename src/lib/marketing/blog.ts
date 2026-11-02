import { z } from 'zod'
import { slugify } from '@/lib/utils'

/**
 * Blog post rules for staff dashboard and public website (task 45).
 */

export function slugFromTitle(title: string, max = 150): string {
  return slugify(title).slice(0, max).replace(/-+$/, '')
}

export function cleanPostSlug(value: string, max = 150): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, max)
}

export function finishPostSlug(value: string): string {
  return value.replace(/^-+|-+$/g, '')
}

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v)

export const blogPostInputSchema = z.object({
  title: z.string().min(2, 'Tiêu đề bài viết tối thiểu 2 ký tự').max(200, 'Tiêu đề tối đa 200 ký tự'),
  slug: z.string().min(2, 'Đường dẫn (slug) tối thiểu 2 ký tự').max(150, 'Đường dẫn tối đa 150 ký tự'),
  summary: z.preprocess(emptyToNull, z.string().max(500, 'Tóm tắt bài viết tối đa 500 ký tự').nullable().optional()),
  content: z.string().min(10, 'Nội dung bài viết tối thiểu 10 ký tự'),
  coverImage: z.preprocess(emptyToNull, z.string().nullable().optional()),
  isPublished: z.boolean().default(false),
  publishedAt: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  authorName: z.preprocess(emptyToNull, z.string().max(100, 'Tên tác giả tối đa 100 ký tự').nullable().optional()),
  metaTitle: z.preprocess(emptyToNull, z.string().max(150, 'Thẻ tiêu đề SEO tối đa 150 ký tự').nullable().optional()),
  metaDescription: z.preprocess(emptyToNull, z.string().max(300, 'Thẻ mô tả SEO tối đa 300 ký tự').nullable().optional()),
})

export type BlogPostInput = z.infer<typeof blogPostInputSchema>
