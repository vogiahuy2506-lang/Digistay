import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { AdminActionError, VERIFIED_VIA, resetTwoFactor } from '@/lib/admin/users'

const body = z.object({
  /** How the person was verified before (docs/RUNBOOK.md): a call, a video call, their workspace owner. */
  verifiedVia: z.enum(VERIFIED_VIA, { errorMap: () => ({ message: 'Chọn cách đã xác minh người yêu cầu' }) }),
  note: z.string().trim().min(3, 'Ghi rõ lý do (ít nhất 3 ký tự)').max(500),
})

/**
 * DELETE /api/admin/users/[userId]/two-factor { verifiedVia, note } — turns
 * off the account's two-factor sign-in (src/lib/admin/users.ts resetTwoFactor).
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  try {
    await resetTwoFactor(granted.admin, userId, parsed.data.verifiedVia, parsed.data.note)
    return NextResponse.json({ success: true, data: { twoFactor: false } })
  } catch (error) {
    if (error instanceof AdminActionError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    throw error
  }
}
