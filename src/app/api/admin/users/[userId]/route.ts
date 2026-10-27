import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { AdminActionError, lockUser, unlockUser } from '@/lib/admin/users'

const body = z.object({
  locked: z.boolean(),
  /** Why it is locked, or unlocked: shown to the next operator and logged. */
  note: z.string().trim().min(3, 'Ghi rõ lý do (ít nhất 3 ký tự)').max(500),
})

/** PATCH /api/admin/users/[userId] { locked, note } — locks or unlocks an account (src/lib/admin/users.ts). */
export async function PATCH(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  try {
    if (parsed.data.locked) await lockUser(granted.admin, userId, parsed.data.note)
    else await unlockUser(granted.admin, userId, parsed.data.note)
    return NextResponse.json({ success: true, data: { locked: parsed.data.locked } })
  } catch (error) {
    if (error instanceof AdminActionError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    throw error
  }
}
