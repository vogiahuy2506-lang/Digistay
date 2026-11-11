import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import {
  updateAdminRole,
  toggleAdminDisabled,
  revokeAdminRole,
  AdminTeamError,
} from '@/lib/admin/team'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PatchActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('CHANGE_ROLE'),
    role: z.enum(['SUPER_ADMIN', 'ADMIN']),
  }),
  z.object({
    action: z.literal('TOGGLE_DISABLE'),
    disabled: z.boolean(),
    reason: z.string().trim().max(300).optional(),
  }),
])

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { userId } = await props.params
  const body = await request.json().catch(() => null)
  const parsed = PatchActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Yêu cầu không hợp lệ' },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.action === 'CHANGE_ROLE') {
      const updated = await updateAdminRole(check.admin, userId, parsed.data.role)
      return NextResponse.json({
        success: true,
        message: `Đã thay đổi vai trò thành ${parsed.data.role}`,
        data: updated,
      })
    } else {
      const updated = await toggleAdminDisabled(
        check.admin,
        userId,
        parsed.data.disabled,
        parsed.data.reason
      )
      return NextResponse.json({
        success: true,
        message: parsed.data.disabled
          ? 'Đã tạm khóa tài khoản quản trị'
          : 'Đã mở khóa tài khoản quản trị',
        data: updated,
      })
    }
  } catch (error) {
    if (error instanceof AdminTeamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật tài khoản quản trị' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { userId } = await props.params

  try {
    const updated = await revokeAdminRole(check.admin, userId)
    return NextResponse.json({
      success: true,
      message: `Đã thu hồi quyền quản trị của ${updated.email}`,
      data: updated,
    })
  } catch (error) {
    if (error instanceof AdminTeamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi thu hồi quyền quản trị' },
      { status: 500 }
    )
  }
}

