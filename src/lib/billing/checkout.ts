/**
 * Buying a plan: a PayOS link on Digistay's account (platform-payos.ts),
 * its VietQR drawn on our own page, and the money applied whichever way it
 * is reported first: webhook, the page asking (syncSubscriptionPayment) or
 * the reconcile job. Like the hotels' payments (src/lib/payments/payos.ts):
 *
 * - PAID is one conditional update, so duplicates do nothing.
 * - The amount must match exactly; a mismatch is logged and not applied.
 * - Money for a link we cancelled or that expired is still applied: it
 *   reached Digistay's account.
 * - The return URL never marks anything paid.
 *
 * Applying a payment starts a new period from that moment (decision
 * 2026-10-26: nothing carries over from the period before).
 */
import { Prisma, type BillingPeriod, type SubscriptionPayment } from '@prisma/client'
import { prisma } from '@/lib/db'
import { newOrderCode } from '@/lib/payments/payos'
import { sendAfterResponse } from '@/lib/email/outbox'
import type { PlanId } from '@/lib/marketing/plans'
import { periodEndFrom, priceFor } from './period'
import { platformPayos, platformPayosConfigured } from './platform-payos'
import { queueSubscriptionPaid } from './emails'

/** How long a plan's QR can be paid. */
export const CHECKOUT_TTL_SEC = 30 * 60
const PAYABLE = ['PENDING', 'CANCELLED', 'EXPIRED', 'FAILED'] as const

export const PAYOS_NOT_READY = 'Digistay chưa kết nối PayOS để nhận tiền mua gói. Vui lòng thử lại sau hoặc liên hệ Digistay.'

export class BillingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'BillingError'
  }
}

const PLAN_CODE: Record<PlanId, string> = { starter: 'STARTER', growth: 'GROWTH', business: 'BUSINESS' }

/** What the payer's bank shows: ASCII, at most 25 characters. */
export function checkoutDescription(plan: PlanId, billing: BillingPeriod): string {
  return `DIGISTAY ${PLAN_CODE[plan]} ${billing === 'YEAR' ? 'NAM' : 'THANG'}`.slice(0, 25)
}

function payosMessage(error: unknown): string {
  const desc = (error as { desc?: unknown })?.desc
  if (typeof desc === 'string' && desc) return desc
  return error instanceof Error && error.message ? error.message : 'Không kết nối được PayOS'
}

/**
 * A new payment for `plan` / `billing` and its PayOS link. Earlier links of
 * the workspace still waiting are marked cancelled here (PayOS is not asked:
 * if one is paid anyway, its money is still applied).
 */
export async function createCheckout(input: {
  workspaceId: string
  plan: PlanId
  billing: BillingPeriod
  userId: string
  returnUrl: string
}): Promise<SubscriptionPayment> {
  if (!platformPayosConfigured()) throw new BillingError(PAYOS_NOT_READY, 503)
  const amount = priceFor(input.plan, input.billing)
  await prisma.subscriptionPayment.updateMany({
    where: { workspaceId: input.workspaceId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })
  const payment = await prisma.subscriptionPayment.create({
    data: {
      workspaceId: input.workspaceId,
      plan: input.plan,
      billing: input.billing,
      amount,
      orderCode: String(newOrderCode()),
      createdById: input.userId,
    },
  })
  const expiredAt = Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SEC
  try {
    const link = await platformPayos().paymentRequests.create({
      orderCode: Number(payment.orderCode),
      amount,
      description: checkoutDescription(input.plan, input.billing),
      returnUrl: input.returnUrl,
      cancelUrl: input.returnUrl,
      expiredAt,
    })
    return prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { checkoutUrl: link.checkoutUrl, qrCode: link.qrCode, expiresAt: new Date(expiredAt * 1000) },
    })
  } catch (error) {
    await prisma.subscriptionPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED' } })
    throw new BillingError(`PayOS không tạo được mã thanh toán: ${payosMessage(error)}`, 502)
  }
}

export type PlanPaidOutcome = 'paid' | 'duplicate' | 'unknown' | 'amount_mismatch' | 'not_payable'

/** Applies money PayOS reports for a plan payment. Safe to call any number of times, concurrently. */
export async function applySubscriptionPaid(input: {
  orderCode: number | string
  amount: number
  reference?: string | null
  source: 'webhook' | 'reconcile'
  now?: Date
}): Promise<PlanPaidOutcome> {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { orderCode: String(input.orderCode) } })
  if (!payment) return 'unknown'
  if (payment.status === 'PAID') return 'duplicate'
  if (!(PAYABLE as readonly string[]).includes(payment.status)) return 'not_payable'
  if (Math.round(input.amount) !== payment.amount) {
    console.warn(`[billing] PayOS amount ${input.amount} for plan payment ${payment.id} expected ${payment.amount} (${input.source})`)
    return 'amount_mismatch'
  }

  const paidAt = input.now ?? new Date()
  const periodEnd = periodEndFrom(paidAt, payment.billing)
  const applied = await prisma.$transaction(async (tx) => {
    const marked = await tx.subscriptionPayment.updateMany({
      where: { id: payment.id, status: { in: [...PAYABLE] } },
      data: { status: 'PAID', paidAt, reference: input.reference ?? null, periodStart: paidAt, periodEnd },
    })
    if (marked.count === 0) return null
    await tx.subscription.upsert({
      where: { workspaceId: payment.workspaceId },
      create: { workspaceId: payment.workspaceId, plan: payment.plan, billing: payment.billing, trial: false, periodStart: paidAt, periodEnd },
      update: { plan: payment.plan, billing: payment.billing, trial: false, periodStart: paidAt, periodEnd, reminders: Prisma.DbNull },
    })
    return queueSubscriptionPaid(payment.id, tx)
  })
  if (!applied) return 'duplicate'
  sendAfterResponse(applied)
  return 'paid'
}

/** Asks PayOS about one plan payment and applies what it says; returns the status after. */
export async function syncSubscriptionPayment(paymentId: string) {
  const payment = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: paymentId } })
  if (payment.status === 'PAID' || !platformPayosConfigured()) return payment.status
  let link
  try {
    link = await platformPayos().paymentRequests.get(Number(payment.orderCode))
  } catch (error) {
    throw new BillingError(`Không hỏi được PayOS: ${payosMessage(error)}`, 502)
  }
  if (link.status === 'PAID') {
    await applySubscriptionPaid({
      orderCode: payment.orderCode,
      amount: link.amountPaid,
      reference: link.transactions[0]?.reference ?? null,
      source: 'reconcile',
    })
  } else if (link.status === 'CANCELLED' || link.status === 'EXPIRED') {
    await prisma.subscriptionPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: link.status } })
  }
  return (await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } })).status
}

/** For the reconcile job: plan payments still waiting from the last 3 days, a missed webhook found. */
export async function reconcileSubscriptionPayments(now = new Date()) {
  if (!platformPayosConfigured()) return { checked: 0, paid: 0, failed: 0 }
  const waiting = await prisma.subscriptionPayment.findMany({
    where: { status: 'PENDING', createdAt: { gte: new Date(now.getTime() - 3 * 86_400_000) } },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: { id: true },
  })
  let paid = 0
  let failed = 0
  for (const { id } of waiting) {
    try {
      if ((await syncSubscriptionPayment(id)) === 'PAID') paid++
    } catch (error) {
      failed++
      console.error(`[billing] reconcile of plan payment ${id} failed:`, error)
    }
  }
  return { checked: waiting.length, paid, failed }
}

/**
 * The webhook of Digistay's account: 2xx for everything PayOS should not
 * resend (including its confirm-webhook test, whose order code is unknown),
 * 400 for a bad signature, 404 when no account is set up.
 */
export async function handlePlatformWebhook(body: unknown): Promise<{ status: number; outcome: string }> {
  if (!platformPayosConfigured()) return { status: 404, outcome: 'not_configured' }
  let data
  try {
    data = await platformPayos().webhooks.verify(body as Parameters<ReturnType<typeof platformPayos>['webhooks']['verify']>[0])
  } catch {
    return { status: 400, outcome: 'invalid_signature' }
  }
  if (data.code !== '00') return { status: 200, outcome: 'ignored' }
  const outcome = await applySubscriptionPaid({ orderCode: data.orderCode, amount: data.amount, reference: data.reference, source: 'webhook' })
  return { status: 200, outcome }
}
