import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { wardsOf } from '@/lib/vn-admin/wards'

/**
 * One province's wards for the address pickers (src/components/address):
 * the browser gets the province it picked, not the whole country. Static
 * data (src/data/vn-admin), so the browser may keep it for a day. Behind
 * sign-in: only staff forms use it.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  const { code } = await props.params
  const wards = wardsOf(code)
  if (!wards) {
    return NextResponse.json({ success: false, error: 'Tỉnh/thành phố không có trong danh sách' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: wards }, { headers: { 'Cache-Control': 'private, max-age=86400' } })
}
