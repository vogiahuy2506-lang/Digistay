import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { z } from 'zod'
import { generateHospitalityContent } from '@/lib/ai/content-generator'
import { AiContentType, AiLanguage, AiTone } from '@/lib/ai/types'
import { checkAiMonthlyQuota, recordAiContentGenerated } from '@/lib/ai/quota'

const imageSchema = z.object({
  url: z.string().min(1),
  base64: z.string().optional(),
  caption: z.string().optional(),
  name: z.string().optional(),
})

const generateSchema = z.object({
  contentType: z.enum(['ROOM_DESCRIPTION', 'BLOG_POST'] as [AiContentType, ...AiContentType[]]),
  keywords: z.string().min(1, 'Vui lòng nhập ít nhất vài từ khóa'),
  roomName: z.string().optional(),
  bedType: z.string().optional(),
  area: z.number().nullable().optional(),
  tone: z.enum(['LUXURY', 'COZY', 'MODERN', 'ROMANTIC', 'FAMILY'] as [AiTone, ...AiTone[]]).optional(),
  language: z.enum(['vi', 'en', 'bilingual'] as [AiLanguage, ...AiLanguage[]]).optional(),
  targetAudience: z.string().optional(),
  topic: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  images: z.array(imageSchema).optional(),
})

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true, name: true, workspaceId: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 403 })
    }

    // Check monthly AI generation quota
    const quota = await checkAiMonthlyQuota(property.workspaceId)
    if (!quota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: quota.message || 'Đã hết lượt tạo nội dung AI trong tháng này.',
          code: 'AI_QUOTA_EXCEEDED',
          data: { quota },
        },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = generateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const input = {
      ...parsed.data,
      propertyName: property.name || 'Khách sạn',
    }

    const generated = await generateHospitalityContent(input)

    // Record usage log
    await recordAiContentGenerated({
      userId: session.user.id,
      workspaceId: property.workspaceId,
      propertyId: property.id,
      contentType: input.contentType,
      modelUsed: generated.modelUsed,
      title: generated.title,
    }).catch((err) => console.warn('[recordAiContentGenerated failed]:', err))

    return NextResponse.json({
      success: true,
      data: {
        ...generated,
        quota: {
          used: quota.used + 1,
          limit: quota.limit,
          remaining: Math.max(0, quota.remaining - 1),
        },
      },
    })
  } catch (error) {
    console.error('[API AI Generate Content Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể tạo nội dung bằng AI lúc này' }, { status: 500 })
  }
}

