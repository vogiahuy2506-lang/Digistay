/**
 * Shared by POST /api/payments/[id]/sync and /cancel (which check the
 * session themselves): who may work payments at the payment's property
 * (payments_manage) only; outsiders get the same 404 as a missing payment.
 * With `refuseWhenLocked` (cancel), a locked workspace gets 402
 * (src/lib/billing); sync stays open: it records money PayOS already
 * received.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { can, checkAccess } from '@/lib/auth/access'
import { PayosError } from '@/lib/payments/payos'
import { lockedResponseForProperty } from '@/lib/billing/guard'

export async function payosPaymentAction(
  paymentId: string,
  userId: string,
  action: (paymentId: string) => Promise<string>,
  options: { refuseWhenLocked?: boolean } = {}
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, propertyId: true, property: { select: { workspaceId: true } } },
  })
  if (!payment) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy thanh toán' }, { status: 404 })
  }
  const granted = await checkAccess(userId, payment.property.workspaceId, null, {
    propertyId: payment.propertyId,
    notFound: 'Không tìm thấy thanh toán',
  })
  if (!granted.ok) return granted.response
  if (!can(granted.access, 'payments_manage', payment.propertyId)) {
    return NextResponse.json({ success: false, error: 'Bạn không có quyền với khoản thanh toán này' }, { status: 403 })
  }
  if (options.refuseWhenLocked) {
    const locked = await lockedResponseForProperty(payment.propertyId)
    if (locked) return locked
  }
  try {
    return NextResponse.json({ success: true, data: { status: await action(payment.id) } })
  } catch (error) {
    if (error instanceof PayosError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[payos] payment action failed:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xử lý thanh toán PayOS' }, { status: 500 })
  }
}
