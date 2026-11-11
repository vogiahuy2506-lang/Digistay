import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { listAdminTeam, assignAdminRole, AdminTeamError } from '@/lib/admin/team'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const AssignRoleSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN'], {
    errorMap: () => ({ message: 'Vai trò phải là SUPER_ADMIN hoặc ADMIN' }),
  }),
})

export async function GET() {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const data = await listAdminTeam()
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = AssignRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 }
    )
  }

  try {
    const updated = await assignAdminRole(check.admin, parsed.data.email, parsed.data.role)
    return NextResponse.json({
      success: true,
      message: `Đã phân quyền ${parsed.data.role} cho ${parsed.data.email}`,
      data: updated,
    })
  } catch (error) {
    if (error instanceof AdminTeamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi phân quyền quản trị' },
      { status: 500 }
    )
  }
}

