import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { refineWebsiteTextWithAi } from '@/lib/ai/website-ai'

const schema = z.object({
  text: z.string().trim().min(1, 'Vui lòng nhập đoạn văn bản cần xử lý'),
  action: z.enum(['rewrite', 'luxury', 'shorten', 'seo', 'translate_en']),
  context: z.string().trim().optional(),
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

    const result = await refineWebsiteTextWithAi({
      text: parsed.data.text,
      action: parsed.data.action,
      context: parsed.data.context,
    })

    return NextResponse.json({
      success: true,
      data: { text: result },
    })
  } catch (error) {
    console.error('[API refine-text] Error:', error)
    return NextResponse.json({ success: false, error: 'Không thể chỉnh sửa văn bản bằng AI lúc này' }, { status: 500 })
  }
}
