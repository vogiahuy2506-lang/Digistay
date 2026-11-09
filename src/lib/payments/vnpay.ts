/**
 * VNPay payment gateway integration.
 * Hotels connect their VNPay Merchant credentials (TMN Code, Hash Secret),
 * enabling guests to pay via VNPay-QR, ATM Cards, and International Cards (Visa/Master).
 *
 * Secrets are encrypted with secret-box bound to the property.
 */
import { createHmac } from 'crypto'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, maskSecret, secretContext } from '@/lib/security/secret-box'
import { sendAfterResponse } from '@/lib/email/outbox'
import { lockBooking, syncBookingPayments } from './booking-payments'
import { queueGuestDepositReceived } from './deposit-received'

export class VnpayError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'VnpayError'
  }
}

const keyCtx = (propertyId: string, field: 'hashSecret') =>
  secretContext('property_vnpay', propertyId, field)

export function vnpayWebhookUrlFor(propertyId: string): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${base}/api/webhooks/vnpay/${propertyId}`
}

export async function getVnpayStatus(propertyId: string) {
  const row = await prisma.propertyVnpay.findUnique({
    where: { propertyId },
    select: { tmnCode: true, environment: true, hashSecret: true, updatedAt: true },
  })
  return {
    connected: Boolean(row),
    tmnCode: row?.tmnCode ?? null,
    environment: row?.environment ?? 'SANDBOX',
    hashSecretHint: row ? maskSecret(decryptSecret(row.hashSecret, keyCtx(propertyId, 'hashSecret'))) : null,
    webhookUrl: vnpayWebhookUrlFor(propertyId),
    updatedAt: row?.updatedAt ?? null,
  }
}

export async function connectVnpay(
  propertyId: string,
  input: {
    tmnCode: string
    hashSecret: string
    environment?: 'SANDBOX' | 'PRODUCTION'
  },
  userId: string
) {
  const tmnCode = input.tmnCode.trim()
  const hashSecret = input.hashSecret.trim()

  if (!tmnCode || !hashSecret) {
    throw new VnpayError('Vui lòng điền Terminal ID (TMN Code) và Hash Secret')
  }

  const data = {
    tmnCode,
    hashSecret: encryptSecret(hashSecret, keyCtx(propertyId, 'hashSecret')),
    environment: input.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
    connectedById: userId,
  }

  await prisma.propertyVnpay.upsert({
    where: { propertyId },
    create: { propertyId, ...data },
    update: data,
  })

  return getVnpayStatus(propertyId)
}

export async function disconnectVnpay(propertyId: string): Promise<void> {
  await prisma.propertyVnpay.deleteMany({ where: { propertyId } })
}

/**
 * Handles incoming VNPay IPN notification.
 */
export async function handleVnpayIpn(
  propertyId: string,
  params: Record<string, string>
): Promise<{ rspCode: string; message: string }> {
  const row = await prisma.propertyVnpay.findUnique({ where: { propertyId } })
  if (!row) return { rspCode: '97', message: 'Property not found or VNPay not connected' }

  const hashSecret = decryptSecret(row.hashSecret, keyCtx(propertyId, 'hashSecret'))
  const secureHash = params['vnp_SecureHash']

  // Sort parameters alphabetically
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
    .sort()

  const signData = sortedKeys
    .map((k) => `${k}=${params[k]}`)
    .join('&')

  const checkHash = createHmac('sha512', hashSecret).update(Buffer.from(signData, 'utf-8')).digest('hex')

  if (secureHash !== checkHash) {
    return { rspCode: '97', message: 'Invalid Checksum' }
  }

  const txnRef = params['vnp_TxnRef']
  const responseCode = params['vnp_ResponseCode']
  const transactionStatus = params['vnp_TransactionStatus']
  const amount = Number(params['vnp_Amount']) / 100 // VNPay multiplies amount by 100

  const payment = await prisma.payment.findFirst({
    where: {
      propertyId,
      OR: [
        { id: txnRef },
        { gatewayOrderCode: txnRef },
      ],
    },
  })

  if (!payment) {
    return { rspCode: '01', message: 'Order Not Found' }
  }

  if (payment.status === 'PAID') {
    return { rspCode: '02', message: 'Order already confirmed' }
  }

  if (responseCode === '00' && transactionStatus === '00') {
    const result = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, payment.bookingId)
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } })
      if (current.status === 'PAID') return { emailIds: [] }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paymentGateway: 'VNPAY',
          method: 'CARD',
          paidAt: new Date(),
          transactionId: params['vnp_TransactionNo'] || txnRef,
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
            gateway: 'VNPAY',
            amount,
            reference: params['vnp_TransactionNo'],
            source: 'vnpay_ipn',
          },
        },
      })

      const emailIds = await queueGuestDepositReceived(tx, payment, closed)
      return { emailIds }
    })

    sendAfterResponse(result.emailIds)
    return { rspCode: '00', message: 'Confirm Success' }
  }

  return { rspCode: '00', message: 'Payment status acknowledged' }
}

