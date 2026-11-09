/**
 * SePay integration with one account per property.
 * Hotels connect their SePay account (API Key / Webhook authentication),
 * guests transfer money directly into the hotel's bank account,
 * and SePay notifies Digistay via real-time transaction webhook.
 *
 * Secrets are encrypted with secret-box bound to the property.
 */
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, maskSecret, secretContext } from '@/lib/security/secret-box'
import { sendAfterResponse } from '@/lib/email/outbox'
import { lockBooking, syncBookingPayments } from './booking-payments'
import { queueGuestDepositReceived } from './deposit-received'

export class SepayError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'SepayError'
  }
}

const keyCtx = (propertyId: string, field: 'apiKey' | 'webhookToken') =>
  secretContext('property_sepay', propertyId, field)

export function sepayWebhookUrlFor(propertyId: string): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${base}/api/webhooks/sepay/${propertyId}`
}

export async function getSepayStatus(propertyId: string) {
  const row = await prisma.propertySepay.findUnique({
    where: { propertyId },
    select: { apiKey: true, accountNumber: true, bankCode: true, updatedAt: true },
  })
  return {
    connected: Boolean(row),
    apiKeyHint: row ? maskSecret(decryptSecret(row.apiKey, keyCtx(propertyId, 'apiKey'))) : null,
    accountNumber: row?.accountNumber ?? null,
    bankCode: row?.bankCode ?? null,
    webhookUrl: sepayWebhookUrlFor(propertyId),
    updatedAt: row?.updatedAt ?? null,
  }
}

export async function connectSepay(
  propertyId: string,
  input: {
    apiKey: string
    webhookToken?: string
    accountNumber?: string
    bankCode?: string
  },
  userId: string
) {
  const apiKey = input.apiKey.trim()
  if (!apiKey) throw new SepayError('Vui lòng nhập SePay API Key')

  const data = {
    apiKey: encryptSecret(apiKey, keyCtx(propertyId, 'apiKey')),
    webhookToken: input.webhookToken?.trim()
      ? encryptSecret(input.webhookToken.trim(), keyCtx(propertyId, 'webhookToken'))
      : null,
    accountNumber: input.accountNumber?.trim() || null,
    bankCode: input.bankCode?.trim() || null,
    connectedById: userId,
  }

  await prisma.propertySepay.upsert({
    where: { propertyId },
    create: { propertyId, ...data },
    update: data,
  })

  return getSepayStatus(propertyId)
}

export async function disconnectSepay(propertyId: string): Promise<void> {
  await prisma.propertySepay.deleteMany({ where: { propertyId } })
}

export interface SepayWebhookPayload {
  id?: number
  gateway?: string
  transactionDate?: string
  accountNumber?: string
  code?: string | null
  content?: string
  transferType?: 'in' | 'out'
  transferAmount?: number
  accumulated?: number
  subAccount?: string | null
  referenceCode?: string
  description?: string
}

/**
 * Handles incoming SePay webhook transaction notification.
 */
export async function handleSepayWebhook(
  propertyId: string,
  authHeader: string | null,
  body: SepayWebhookPayload
): Promise<{ status: number; outcome: string }> {
  const row = await prisma.propertySepay.findUnique({ where: { propertyId } })
  if (!row) return { status: 404, outcome: 'not_connected' }

  // Verify webhook token if configured
  if (row.webhookToken) {
    const expectedToken = decryptSecret(row.webhookToken, keyCtx(propertyId, 'webhookToken'))
    const authVal = authHeader?.replace(/^Apikey\s+/i, '')?.replace(/^Bearer\s+/i, '')?.trim()
    if (!authVal || authVal !== expectedToken) {
      return { status: 401, outcome: 'unauthorized' }
    }
  }

  if (body.transferType !== 'in' || !body.transferAmount || body.transferAmount <= 0) {
    return { status: 200, outcome: 'ignored_not_incoming' }
  }

  const content = (body.content || body.description || '').toUpperCase()
  const amount = body.transferAmount

  // Find a matching pending payment for this property
  // Content usually contains booking code (e.g., BK..., DS..., or alphanumeric code)
  const pendingPayments = await prisma.payment.findMany({
    where: {
      propertyId,
      status: 'PENDING',
      amount,
    },
    include: { booking: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Try to find the payment whose booking code or booking ID appears in the transfer content
  let matched = pendingPayments.find((p) => {
    if (p.booking?.bookingCode && content.includes(p.booking.bookingCode.toUpperCase())) return true
    if (p.gatewayOrderCode && content.includes(p.gatewayOrderCode.toUpperCase())) return true
    return false
  })

  // If no exact booking code match but only one pending payment has the exact amount within 2 hours
  if (!matched && pendingPayments.length === 1) {
    const ageMs = Date.now() - pendingPayments[0].createdAt.getTime()
    if (ageMs < 2 * 60 * 60 * 1000) {
      matched = pendingPayments[0]
    }
  }

  if (!matched) {
    return { status: 200, outcome: 'payment_not_found' }
  }

  const target = matched
  const result = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, target.bookingId)
    const current = await tx.payment.findUniqueOrThrow({ where: { id: target.id } })
    if (current.status === 'PAID') return { outcome: 'already_paid', emailIds: [] }

    const paidAt = body.transactionDate ? new Date(body.transactionDate) : new Date()
    await tx.payment.update({
      where: { id: target.id },
      data: {
        status: 'PAID',
        paymentGateway: 'SEPAY',
        method: 'BANK_TRANSFER',
        paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
        transactionId: body.referenceCode || String(body.id || ''),
      },
    })

    const { closed } = await syncBookingPayments(tx, target.bookingId)

    await tx.activityLog.create({
      data: {
        propertyId,
        action: 'PAYMENT_RECEIVED',
        entityType: 'PAYMENT',
        entityId: target.id,
        metadata: {
          bookingId: target.bookingId,
          gateway: 'SEPAY',
          amount: target.amount,
          reference: body.referenceCode,
          source: 'sepay_webhook',
        },
      },
    })

    const emailIds = await queueGuestDepositReceived(tx, target, closed)
    return { outcome: 'paid', emailIds }
  })

  sendAfterResponse(result.emailIds)
  return { status: 200, outcome: result.outcome }
}

