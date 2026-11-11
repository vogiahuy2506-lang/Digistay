import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { resetAdminTwoFactor, AdminTeamError } from '@/lib/admin/team'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ResetSchema = z.object({
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do reset 2FA (tối thiểu 3 ký tự)').max(500),
})

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { userId } = await props.params
  const body = await request.json().catch(() => null)
  const parsed = ResetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 }
    )
  }

  try {
    await resetAdminTwoFactor(check.admin, userId, parsed.data.reason)
    return NextResponse.json({
      success: true,
      message: 'Đã đặt lại xác thực 2 bước (2FA) thành công',
    })
  } catch (error) {
    if (error instanceof AdminTeamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi đặt lại 2FA' },
      { status: 500 }
    )
  }
}

