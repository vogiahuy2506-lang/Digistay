import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { answerHotelChatbotQuestion } from '@/lib/ai/chatbot'

const chatbotQuerySchema = z.object({
  propertyId: z.string().min(1, 'Không tìm thấy thông tin cơ sở'),
  message: z.string().trim().min(1, 'Vui lòng nhập câu hỏi của bạn').max(1000, 'Câu hỏi không được quá 1000 ký tự'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })
    )
    .optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const byIp = await hit(LIMITS.chatbotMessageIp, getClientIp(request.headers))
    if (!byIp.allowed) {
      return tooManyRequests('Bạn đã gửi tin nhắn quá nhanh. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
    }

    const body = await request.json().catch(() => null)
    const parsed = chatbotQuerySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || 'Lỗi khi xử lý câu hỏi' }, { status: 400 })
    }

    const { propertyId, message, history, apiKey, model } = parsed.data

    const response = await answerHotelChatbotQuestion({
      propertyId,
      message,
      history,
      apiKey,
      model,
    })

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('[Public Chatbot API Error]:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xử lý câu hỏi' }, { status: 500 })
  }
}

