import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { accessibleProperties } from '@/lib/auth/access'
import { testGeminiApiKey } from '@/lib/ai/content-generator'
import { checkAiMonthlyQuota } from '@/lib/ai/quota'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true, workspaceId: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 403 })
    }

    const envKey = process.env.GEMINI_API_KEY
    const hasEnvKey = Boolean(envKey && envKey.trim().length > 0)
    const masked = hasEnvKey ? `${envKey!.slice(0, 6)}...${envKey!.slice(-4)}` : null
    const quota = await checkAiMonthlyQuota(property.workspaceId)

    return NextResponse.json({
      success: true,
      data: {
        hasEnvKey,
        maskedKey: masked,
        provider: 'GEMINI',
        defaultModel: 'gemini-2.5-flash',
        quota,
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

    const property = await prisma.property.findFirst({
      where: { id: params.id, ...accessibleProperties(session.user.id) },
      select: { id: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const keyToTest = (body?.apiKey && typeof body.apiKey === 'string' && body.apiKey.trim()) || process.env.GEMINI_API_KEY
    if (!keyToTest) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp khóa API' }, { status: 400 })
    }

    const model = (body?.model && typeof body.model === 'string') ? body.model : 'gemini-2.5-flash'
    const testResult = await testGeminiApiKey(keyToTest, model)

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

