import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { syncAllPropertyCustomers } from '@/lib/customers/sync-customer'

/**
 * POST /api/properties/[id]/customers/sync
 * Quét toàn bộ các đơn đặt phòng trong quá khứ để đồng bộ/cập nhật danh bạ khách hàng.
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await props.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, propertyId, 'bookings_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const result = await syncAllPropertyCustomers(propertyId)

    return NextResponse.json({
      success: true,
      data: result,
      message: `Đã đồng bộ thành công ${result.synced} khách hàng từ các đơn đặt phòng`,
    })
  } catch (error) {
    console.error('Sync customers error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi đồng bộ danh bạ khách hàng' }, { status: 500 })
  }
}
