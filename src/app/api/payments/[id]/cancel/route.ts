import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/rbac'
import { cancelPayosPayment } from '@/lib/payments/payos'
import { payosPaymentAction } from '../../payos-access'

/** POST /api/payments/[id]/cancel — cancel an unpaid PayOS link. */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const sess = await requireSession()
  if (!sess.ok) return sess.response
  const { id } = await props.params
  return payosPaymentAction(id, sess.session.user.id, cancelPayosPayment)
}
