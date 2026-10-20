/**
 * Scheduled PayOS reconcile (runs every 10 minutes, see
 * docker/systemd/digistay-reconcile.timer). Webhooks get lost: PayOS gives
 * up after a few retries, or our site was down. This asks PayOS about
 * recent pending links and applies what it says, through the same
 * conditional update as the webhook, so running it twice changes nothing.
 * A payment found PAID here means a webhook was missed: it is logged so
 * someone checks the property's webhook URL.
 */
import { prisma } from '@/lib/db'
import { PayosError, syncPayosPayment } from './payos'

/** Links live 24 h; a little longer catches late status changes. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000
const MAX_PER_RUN = 100

export interface ReconcileSummary {
  checked: number
  paid: number
  expired: number
  cancelled: number
  errors: number
}

export async function reconcilePendingPayos(now = new Date()): Promise<ReconcileSummary> {
  const pending = await prisma.payment.findMany({
    where: {
      paymentGateway: 'PAYOS',
      status: 'PENDING',
      gatewayOrderCode: { not: null },
      createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS) },
    },
    select: { id: true, propertyId: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_PER_RUN,
  })

  const summary: ReconcileSummary = { checked: 0, paid: 0, expired: 0, cancelled: 0, errors: 0 }
  for (const payment of pending) {
    summary.checked++
    try {
      const status = await syncPayosPayment(payment.id)
      if (status === 'PAID') {
        summary.paid++
        console.warn(
          `[payos] reconcile found payment ${payment.id} paid without a webhook (property ${payment.propertyId}): check its PayOS webhook URL`
        )
      } else if (status === 'EXPIRED') summary.expired++
      else if (status === 'CANCELLED') summary.cancelled++
    } catch (error) {
      // One property's PayOS being unreachable (or disconnected) must not
      // stop the others.
      summary.errors++
      if (!(error instanceof PayosError)) console.error(`[payos] reconcile ${payment.id} failed:`, error)
    }
  }
  return summary
}
