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
 * A payment is applied by period.ts planChange, decided again when the
 * money comes (the state may have moved since the QR): an upgrade or a
 * first plan starts now, a renewal is chained to the end, a downgrade waits
 * for the end (Subscription.next*). A downgrade already waiting moves when
 * the period before it changes. The e-invoice is made in the same
 * transaction when Digistay issues them (einvoice.ts).
 */
import { Prisma, type BillingPeriod, type Subscription, type SubscriptionPayment } from '@prisma/client'
import { prisma } from '@/lib/db'
import { newOrderCode } from '@/lib/payments/payos'
import { sendAfterResponse } from '@/lib/email/outbox'
import { isPlanId, planById, type PlanId } from '@/lib/marketing/plans'
import { periodEndFrom, planChange, priceFor, type ChangeBlock, type PlanChange } from './period'
import { ensureSubscription, startScheduledPlan } from './subscription'
import { vnDate } from './emails'
import { platformPayos, platformPayosConfigured } from './platform-payos'
import { queueSubscriptionPaid } from './emails'
import { issueAfterResponse, prepareSubscriptionInvoice, type InvoiceBuyer } from './einvoice'
import { reconcileOverageSoon } from './overage'

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

const planName = (id: string) => planById(id).id.charAt(0).toUpperCase() + planById(id).id.slice(1)

/** Why checkout refuses a purchase (period.ts planChange), said to the payer. */
export function changeBlockMessage(block: ChangeBlock, change: PlanChange, sub: Pick<Subscription, 'periodEnd' | 'nextPlan' | 'nextBilling'>): string {
  if (block === 'RENEW_TOO_EARLY') {
    return `Gói hiện tại còn hạn đến ${vnDate(sub.periodEnd)}. Bạn có thể gia hạn từ ngày ${vnDate(change.renewFrom!)}.`
  }
  if (block === 'YEARLY_TO_MONTHLY') {
    return 'Gói năm còn từ 30 ngày trở lên nên chưa chuyển sang gói tháng được. Bạn có thể chuyển trong 30 ngày cuối của gói năm.'
  }
  return `Đã hẹn đổi sang gói ${planName(sub.nextPlan ?? '')} từ ngày ${vnDate(sub.periodEnd)}. Không thể hẹn thêm lần đổi gói khác.`
}

/** What buying `plan` / `billing` would do to the workspace's plan now. */
export async function quoteChange(workspaceId: string, plan: PlanId, billing: BillingPeriod, now = new Date()) {
  const sub = await startScheduledPlan(await ensureSubscription(workspaceId, prisma, now), prisma, now)
  return { sub, change: planChange(sub, { plan, billing }, now) }
}

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
  /** Who the e-invoice is for (einvoice.ts); kept until the money comes */
  invoiceBuyer?: InvoiceBuyer
}): Promise<SubscriptionPayment> {
  if (!platformPayosConfigured()) throw new BillingError(PAYOS_NOT_READY, 503)
  const { sub, change } = await quoteChange(input.workspaceId, input.plan, input.billing)
  if (change.blocked) throw new BillingError(changeBlockMessage(change.blocked, change, sub), 409)
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
      ...(input.invoiceBuyer && { invoiceBuyer: input.invoiceBuyer }),
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
  const applied = await prisma.$transaction(async (tx) => {
    const sub = await startScheduledPlan(await ensureSubscription(payment.workspaceId, tx, paidAt), tx, paidAt)
    const marked = await tx.subscriptionPayment.updateMany({
      where: { id: payment.id, status: { in: [...PAYABLE] } },
      data: { status: 'PAID', paidAt, reference: input.reference ?? null },
    })
    if (marked.count === 0) return null
    await applyToSubscription(sub, payment, paidAt, tx)
    const invoiceId = await prepareSubscriptionInvoice(payment, tx)
    return { emails: await queueSubscriptionPaid(payment.id, tx), invoiceId }
  })
  if (!applied) return 'duplicate'
  sendAfterResponse(applied.emails)
  issueAfterResponse(applied.invoiceId)
  // A bigger plan unlocks what was locked over the old one at once (overage.ts).
  reconcileOverageSoon(payment.workspaceId)
  return 'paid'
}

/**
 * Applies a paid payment to the subscription (period.ts planChange; a refusal
 * at checkout does not matter now: the money came, so it buys its period),
 * and writes on the payment the period it pays for and how it was applied.
 */
async function applyToSubscription(sub: Subscription, payment: SubscriptionPayment, paidAt: Date, tx: Prisma.TransactionClient) {
  const plan = isPlanId(payment.plan) ? payment.plan : 'growth'
  const change = planChange(sub, { plan, billing: payment.billing }, paidAt)
  const waiting = sub.nextPlan && sub.nextPeriodEnd ? sub.nextPeriodEnd.getTime() - sub.periodEnd.getTime() : null
  let period: { periodStart: Date; periodEnd: Date }
  let data: Prisma.SubscriptionUpdateInput

  if (change.kind === 'downgrade' || change.blocked === 'YEARLY_TO_MONTHLY') {
    // After the period in force, or after a downgrade already waiting (two
    // paid at once: the later one's plan, both periods' time).
    const after = sub.nextPlan && sub.nextPeriodEnd ? sub.nextPeriodEnd : sub.periodEnd
    period = { periodStart: sub.periodEnd, periodEnd: periodEndFrom(after, payment.billing) }
    data = { nextPlan: plan, nextBilling: payment.billing, nextPeriodEnd: period.periodEnd, nextPaymentId: payment.id }
    if (sub.nextPlan) console.warn(`[billing] plan payment ${payment.id} paid while a downgrade waited: merged into it`)
  } else if (change.kind === 'renew') {
    period = { periodStart: sub.periodEnd, periodEnd: periodEndFrom(sub.periodEnd, payment.billing) }
    data = { plan, billing: payment.billing, trial: false, periodEnd: period.periodEnd, reminders: Prisma.DbNull }
  } else {
    period = { periodStart: paidAt, periodEnd: periodEndFrom(paidAt, payment.billing) }
    data = { plan, billing: payment.billing, trial: false, periodStart: paidAt, periodEnd: period.periodEnd, reminders: Prisma.DbNull }
  }

  // A downgrade waiting starts when the period before it ends: move it with that end.
  const end = (data.periodEnd as Date | undefined) ?? null
  if (waiting !== null && end) {
    const nextEnd = new Date(end.getTime() + waiting)
    data.nextPeriodEnd = nextEnd
    if (sub.nextPaymentId) {
      await tx.subscriptionPayment.updateMany({ where: { id: sub.nextPaymentId }, data: { periodStart: end, periodEnd: nextEnd } })
    }
  }

  await tx.subscription.update({ where: { workspaceId: sub.workspaceId }, data })
  await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { ...period, change: change.kind } })
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
