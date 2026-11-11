import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import {
  getAllPlatformSettings,
  savePlatformSetting,
  testGeminiPing,
  testSmtpEmail,
} from '@/lib/admin/platform-settings'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const SaveSettingSchema = z.object({
  key: z.enum(['payos', 'matbao', 'gemini', 'smtp', 'branding']),
  value: z.record(z.any()),
})

const ActionSchema = z.object({
  action: z.enum(['test_gemini', 'test_smtp']),
  customApiKey: z.string().optional(),
  targetEmail: z.string().email('Email nhận kiểm tra không hợp lệ').optional(),
  smtpConfig: z.any().optional(),
})

export async function GET() {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const settings = await getAllPlatformSettings()
  return NextResponse.json({ success: true, data: settings })
}

export async function PUT(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = SaveSettingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Dữ liệu cấu hình không hợp lệ' },
      { status: 400 }
    )
  }

  const { key, value } = parsed.data
  await savePlatformSetting(key, value, check.admin.id)
  return NextResponse.json({ success: true, message: `Đã lưu cấu hình ${key} thành công.` })
}

export async function POST(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Yêu cầu không hợp lệ' },
      { status: 400 }
    )
  }

  const { action, customApiKey, targetEmail, smtpConfig } = parsed.data

  if (action === 'test_gemini') {
    const res = await testGeminiPing(customApiKey)
    return NextResponse.json({ success: res.ok, message: res.message }, { status: res.ok ? 200 : 400 })
  }

  if (action === 'test_smtp') {
    const to = targetEmail || check.admin.email
    const res = await testSmtpEmail(to, smtpConfig)
    return NextResponse.json({ success: res.ok, message: res.message }, { status: res.ok ? 200 : 400 })
  }

  return NextResponse.json({ success: false, error: 'Hành động không hợp lệ' }, { status: 400 })
}

