import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BillingError, syncSubscriptionPayment } from '@/lib/billing/checkout'
import { paymentView } from '@/lib/billing/view'

export async function GET(request: NextRequest, props: { params: Promise<{ paymentId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }

  const { paymentId } = await props.params
  const payment = await prisma.subscriptionPayment.findFirst({
    where: {
      id: paymentId,
      OR: [
        { createdById: session.user.id },
        { workspace: { ownerId: session.user.id } },
      ],
    },
    select: { id: true, status: true },
  })

  if (!payment) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy khoản thanh toán' }, { status: 404 })
  }

  if (payment.status === 'PENDING' && request.nextUrl.searchParams.get('sync') === '1') {
    try {
      await syncSubscriptionPayment(payment.id, 'page')
    } catch (error) {
      if (!(error instanceof BillingError)) throw error
      console.warn('[billing] sync failed:', error.message)
    }
  }

  const fresh = await prisma.subscriptionPayment.findUniqueOrThrow({
    where: { id: payment.id },
    include: { invoice: true },
  })
  return NextResponse.json({ success: true, data: await paymentView(fresh) })
}
