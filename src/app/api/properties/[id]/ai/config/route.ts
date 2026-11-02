import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { z } from 'zod'
import { testGeminiApiKey } from '@/lib/ai/content-generator'

const testKeySchema = z.object({
  apiKey: z.string().min(1, 'Vui lòng cung cấp khóa API'),
  model: z.string().optional().default('gemini-3.1-flash-lite'),
})

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, params.id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const envKey = process.env.GEMINI_API_KEY
    const hasEnvKey = Boolean(envKey && envKey.trim().length > 0)
    const masked = hasEnvKey ? `${envKey!.slice(0, 6)}...${envKey!.slice(-4)}` : null

    return NextResponse.json({
      success: true,
      data: {
        hasEnvKey,
        maskedKey: masked,
        provider: 'GEMINI',
        defaultModel: 'gemini-3.1-flash-lite',
      },
    })
  } catch (error) {
    console.error('[API AI Config GET Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể kiểm tra cấu hình AI lúc này' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, params.id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => null)
    const parsed = testKeySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const { apiKey, model } = parsed.data
    const testResult = await testGeminiApiKey(apiKey, model)

    if (!testResult.ok) {
      return NextResponse.json({
        success: false,
        error: testResult.message,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: testResult.message,
    })
  } catch (error) {
    console.error('[API AI Test Key Error]:', error)
    return NextResponse.json({ success: false, error: 'Không thể kiểm tra khóa API lúc này' }, { status: 500 })
  }
}

