/** What the plan page receives about a plan payment (no ids of other workspaces, the QR drawn here). */
import QRCode from 'qrcode'
import type { SubscriptionPayment } from '@prisma/client'
import { isPlanId } from '@/lib/marketing/plans'
import { checkoutDescription } from './checkout'

export async function paymentView(p: SubscriptionPayment) {
  const waiting = p.status === 'PENDING' && (!p.expiresAt || p.expiresAt.getTime() > Date.now())
  return {
    id: p.id,
    plan: p.plan,
    billing: p.billing,
    amount: p.amount,
    status: p.status,
    orderCode: p.orderCode,
    description: isPlanId(p.plan) ? checkoutDescription(p.plan, p.billing) : null,
    checkoutUrl: waiting ? p.checkoutUrl : null,
    qrImage: waiting && p.qrCode ? await QRCode.toDataURL(p.qrCode, { margin: 1, width: 560, errorCorrectionLevel: 'M' }) : null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    periodStart: p.periodStart?.toISOString() ?? null,
    periodEnd: p.periodEnd?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }
}

export type PaymentView = Awaited<ReturnType<typeof paymentView>>
