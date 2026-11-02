import { describe, expect, it } from 'vitest'
import {
  blogPostInputSchema,
  cleanPostSlug,
  finishPostSlug,
  slugFromTitle,
} from './blog'

describe('blog helper functions (task 45)', () => {
  it('converts a Vietnamese title to a clean slug', () => {
    expect(slugFromTitle('Top 5 Quán Ăn Ngon Gần Khách Sạn')).toBe('top-5-quan-an-ngon-gan-khach-san')
    expect(slugFromTitle('Kinh nghiệm du lịch Đà Lạt 3 ngày 2 đêm')).toBe(
      'kinh-nghiem-du-lich-da-lat-3-ngay-2-dem'
    )
    expect(slugFromTitle('Đặc sản biển & ốc đêm')).toBe('dac-san-bien-oc-dem')
  })

  it('cleans user-typed slugs on the fly', () => {
    expect(cleanPostSlug('Ăn Uống Ở Đâu?')).toBe('an-uong-o-dau-')
    expect(cleanPostSlug('---diem-den-moi---')).toBe('diem-den-moi-')
    expect(finishPostSlug('---diem-den-moi---')).toBe('diem-den-moi')
  })

  it('validates a correct blog post input', () => {
    const valid = {
      title: 'Khám phá ẩm thực phố cổ',
      slug: 'kham-pha-am-thuc-pho-co',
      summary: 'Giới thiệu những món ăn truyền thống không thể bỏ lỡ.',
      content: 'Nội dung chi tiết bài viết với đầy đủ thông tin hướng dẫn và gợi ý...',
      coverImage: 'https://images.unsplash.com/photo-1234',
      isPublished: true,
      authorName: 'Admin Khách sạn',
    }

    const res = blogPostInputSchema.safeParse(valid)
    expect(res.success).toBe(true)
  })

  it('rejects short title or short content', () => {
    const invalid = {
      title: 'A',
      slug: 'a',
      content: 'Quá ngắn',
    }

    const res = blogPostInputSchema.safeParse(invalid)
    expect(res.success).toBe(false)
  })
})

