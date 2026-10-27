import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { cancelOrder, findOrder, reviewOrder } from '@/lib/admin/orders'
import { BillingError, syncSubscriptionPayment } from '@/lib/billing/checkout'
import { platformPayosConfigured } from '@/lib/billing/platform-payos'

const schema = z.object({
  action: z.enum(['cancel', 'sync', 'review']),
  note: z.string().trim().max(1000).optional(),
})

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status })

/**
 * POST /api/admin/orders/[id] — what an operator can do about a plan order
 * (src/lib/admin/orders.ts):
 * - `cancel` a code still waiting (at PayOS too, best effort), logged;
 * - `sync`: ask PayOS now and apply what it says (anything but PAID);
 * - `review` an order paid after its code was closed (paidAfter), with a
 *   note saying what was done about it, logged.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response
  const { id } = await props.params
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('Thao tác không hợp lệ', 400)
  const order = await findOrder(id)
  if (!order) return fail('Không tìm thấy đơn hàng', 404)
  const note = parsed.data.note || null

  if (parsed.data.action === 'cancel') {
    if (order.status !== 'PENDING') return fail('Chỉ huỷ được đơn đang chờ thanh toán', 409)
    const result = await cancelOrder(order, granted.admin, note)
    if (!result.cancelled) return fail('Đơn vừa đổi trạng thái, hãy tải lại danh sách', 409)
    return NextResponse.json({ success: true, data: { status: 'CANCELLED', payos: result.payos } })
  }

  if (parsed.data.action === 'sync') {
    if (order.status === 'PAID') return fail('Đơn đã thanh toán, không cần hỏi lại PayOS', 409)
    if (!platformPayosConfigured()) return fail('Chưa cài PayOS của Digistay (DIGISTAY_PAYOS_*)', 503)
    try {
      return NextResponse.json({ success: true, data: { status: await syncSubscriptionPayment(order.id, 'operator') } })
    } catch (error) {
      if (error instanceof BillingError) return fail(error.message, error.status)
      throw error
    }
  }

  if (!order.paidAfter) return fail('Chỉ đánh dấu được đơn trả sau khi đã huỷ hoặc hết hạn', 409)
  if (!note || note.length < 3) return fail('Ghi chú cần ít nhất 3 ký tự', 400)
  if (!(await reviewOrder(order, granted.admin, note))) return fail('Đơn này đã được đánh dấu đã xem', 409)
  return NextResponse.json({ success: true, data: { reviewed: true } })
}
