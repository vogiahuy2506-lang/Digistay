/**
 * Shared by POST /api/payments/[id]/sync and /cancel (which check the
 * session themselves): staff of the payment's property only; outsiders get
 * the same 404 as a missing payment. With `refuseWhenLocked` (cancel), a
 * locked workspace gets 402 (src/lib/billing); sync stays open: it records
 * money PayOS already received.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
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
  const role = payment ? await getWorkspaceRole(payment.property.workspaceId, userId) : null
  if (!payment || !role) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy thanh toán' }, { status: 404 })
  }
  if (!(WorkspaceRoles.STAFF_AND_UP as readonly string[]).includes(role)) {
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
