/**
 * MoMo payment gateway integration (Part of multi-gateway payment suite).
 * Hotels connect their MoMo Business merchant credentials,
 * allowing guests to pay via MoMo QR or MoMo app with instant IPN confirmation.
 *
 * Secrets are encrypted with secret-box bound to the property.
 */
import { createHmac } from 'crypto'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, maskSecret, secretContext } from '@/lib/security/secret-box'
import { sendAfterResponse } from '@/lib/email/outbox'
import { lockBooking, syncBookingPayments } from './booking-payments'
import { queueGuestDepositReceived } from './deposit-received'

export class MomoError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'MomoError'
  }
}

const keyCtx = (propertyId: string, field: 'accessKey' | 'secretKey') =>
  secretContext('property_momo', propertyId, field)

export function momoWebhookUrlFor(propertyId: string): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${base}/api/webhooks/momo/${propertyId}`
}

export async function getMomoStatus(propertyId: string) {
  const row = await prisma.propertyMomo.findUnique({
    where: { propertyId },
    select: { partnerCode: true, environment: true, accessKey: true, updatedAt: true },
  })
  return {
    connected: Boolean(row),
    partnerCode: row?.partnerCode ?? null,
    environment: row?.environment ?? 'SANDBOX',
    accessKeyHint: row ? maskSecret(decryptSecret(row.accessKey, keyCtx(propertyId, 'accessKey'))) : null,
    webhookUrl: momoWebhookUrlFor(propertyId),
    updatedAt: row?.updatedAt ?? null,
  }
}

export async function connectMomo(
  propertyId: string,
  input: {
    partnerCode: string
    accessKey: string
    secretKey: string
    environment?: 'SANDBOX' | 'PRODUCTION'
  },
  userId: string
) {
  const partnerCode = input.partnerCode.trim()
  const accessKey = input.accessKey.trim()
  const secretKey = input.secretKey.trim()

  if (!partnerCode || !accessKey || !secretKey) {
    throw new MomoError('Vui lòng điền đầy đủ Partner Code, Access Key và Secret Key')
  }

  const data = {
    partnerCode,
    accessKey: encryptSecret(accessKey, keyCtx(propertyId, 'accessKey')),
    secretKey: encryptSecret(secretKey, keyCtx(propertyId, 'secretKey')),
    environment: input.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
    connectedById: userId,
  }

  await prisma.propertyMomo.upsert({
    where: { propertyId },
    create: { propertyId, ...data },
    update: data,
  })

  return getMomoStatus(propertyId)
}

export async function disconnectMomo(propertyId: string): Promise<void> {
  await prisma.propertyMomo.deleteMany({ where: { propertyId } })
}

export interface MomoIpnPayload {
  partnerCode: string
  orderId: string
  requestId: string
  amount: number
  orderInfo: string
  orderType: string
  transId: number | string
  resultCode: number
  message: string
  payType: string
  responseTime: number | string
  extraData: string
  signature: string
}

/**
 * Handles incoming MoMo IPN notification.
 */
export async function handleMomoIpn(
  propertyId: string,
  payload: MomoIpnPayload
): Promise<{ status: number; outcome: string }> {
  const row = await prisma.propertyMomo.findUnique({ where: { propertyId } })
  if (!row) return { status: 404, outcome: 'not_connected' }

  const accessKey = decryptSecret(row.accessKey, keyCtx(propertyId, 'accessKey'))
  const secretKey = decryptSecret(row.secretKey, keyCtx(propertyId, 'secretKey'))

  // Verify HMAC SHA256 signature
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData ?? ''}`,
    `message=${payload.message}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `orderType=${payload.orderType}`,
    `partnerCode=${payload.partnerCode}`,
    `payType=${payload.payType}`,
    `requestId=${payload.requestId}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId}`,
  ].join('&')

  const expectedSignature = createHmac('sha256', secretKey).update(rawSignature).digest('hex')
  if (expectedSignature !== payload.signature) {
    return { status: 400, outcome: 'invalid_signature' }
  }

  if (payload.resultCode !== 0) {
    return { status: 200, outcome: 'payment_failed_or_cancelled' }
  }

  // orderId is formatted as booking payment id or orderCode
  const orderId = String(payload.orderId)
  const payment = await prisma.payment.findFirst({
    where: {
      propertyId,
      OR: [
        { id: orderId },
        { gatewayOrderCode: orderId },
      ],
    },
  })

  if (!payment) return { status: 200, outcome: 'payment_not_found' }
  if (payment.status === 'PAID') return { status: 200, outcome: 'already_paid' }

  const result = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, payment.bookingId)
    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } })
    if (current.status === 'PAID') return { outcome: 'already_paid', emailIds: [] }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paymentGateway: 'MOMO',
        method: 'E_WALLET',
        paidAt: new Date(),
        transactionId: String(payload.transId),
      },
    })

    const { closed } = await syncBookingPayments(tx, payment.bookingId)

    await tx.activityLog.create({
      data: {
        propertyId,
        action: 'PAYMENT_RECEIVED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: {
          bookingId: payment.bookingId,
          gateway: 'MOMO',
          amount: payload.amount,
          reference: String(payload.transId),
          source: 'momo_ipn',
        },
      },
    })

    const emailIds = await queueGuestDepositReceived(tx, payment, closed)
    return { outcome: 'paid', emailIds }
  })

  sendAfterResponse(result.emailIds)
  return { status: 200, outcome: result.outcome }
}

