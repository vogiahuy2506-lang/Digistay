import { NextRequest, NextResponse } from 'next/server'
import { requireAccess } from '@/lib/auth/access'
import { memberActivity } from '@/lib/members/activity'

/** GET — the members' log (src/lib/members/activity.ts), newest first: members_manage. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const granted = await requireAccess(id, 'members_manage')
    if (!granted.ok) return granted.response
    return NextResponse.json({ success: true, data: await memberActivity(id) })
  } catch (error) {
    console.error('Get member activity error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi tải nhật ký' }, { status: 500 })
  }
}
