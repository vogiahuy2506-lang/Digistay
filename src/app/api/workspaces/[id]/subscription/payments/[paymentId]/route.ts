import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAccess } from '@/lib/auth/access'
import { BillingError, syncSubscriptionPayment } from '@/lib/billing/checkout'
import { paymentView } from '@/lib/billing/view'

/**
 * GET /api/workspaces/[id]/subscription/payments/[paymentId] — the plan
 * page's poll. `?sync=1` (the "I have transferred" button, and every few
 * polls) also asks PayOS, for a webhook that is late or never comes.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await props.params
  const access = await requireAccess(id, 'billing_manage')
  if (!access.ok) return access.response

  const payment = await prisma.subscriptionPayment.findFirst({ where: { id: paymentId, workspaceId: id }, select: { id: true, status: true } })
  if (!payment) return NextResponse.json({ success: false, error: 'Không tìm thấy khoản thanh toán' }, { status: 404 })

  if (payment.status === 'PENDING' && request.nextUrl.searchParams.get('sync') === '1') {
    try {
      await syncSubscriptionPayment(payment.id, 'page')
    } catch (error) {
      if (!(error instanceof BillingError)) throw error
      console.warn('[billing] sync failed:', error.message)
    }
  }
  const fresh = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id }, include: { invoice: true } })
  return NextResponse.json({ success: true, data: await paymentView(fresh) })
}
