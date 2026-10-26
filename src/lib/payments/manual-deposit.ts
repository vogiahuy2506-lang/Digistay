/**
 * A guest's online deposit paid by plain transfer (deposit-mode.ts, MANUAL):
 * no payment gateway, the money goes straight to the hotel's own bank
 * account or MoMo wallet, and staff confirm it.
 *
 * - When the booking is made, a PENDING payment holds what the guest must
 *   send: the amount (depositFor), the receiving account, the transfer
 *   content (the booking code) and the VietQR payload (src/lib/vietqr),
 *   with the hotel's deadline as expiresAt (guest-deposit.ts cancels the
 *   booking then, as for PayOS).
 * - "Tôi đã chuyển khoản" (claimTransfer): once per booking
 *   (Booking.transferClaimedAt), under the booking's row lock. It pushes the
 *   deadline back CLAIM_EXTENSION_MINUTES so staff have time to check the
 *   account, and tells the front desk (bell + email). Nothing is marked paid.
 * - Staff confirm through the usual POST /api/payments/[id]/confirm: that
 *   path marks it PAID, confirms the booking and emails the guest.
 *
 * Before booking, the guest's room hold is a 15-minute RoomLock (HOLD),
 * which the booking itself replaces: from then on a PENDING booking keeps
 * its room until the deposit deadline, so the deadline is what a claim
 * extends.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { queueTransferClaimed } from '@/lib/email/outbox'
import { notifyTransferClaimed } from '@/lib/notifications'
import { buildVietQr, findBank, isWallet } from '@/lib/vietqr'
import { lockBooking } from './booking-payments'
import { depositAccountIdFrom } from './deposit-mode'

/** How much longer the room is held once the guest says they transferred. */
export const CLAIM_EXTENSION_MINUTES = 30

export class ManualDepositError extends Error {
  constructor(
    message: string,
    readonly status = 409
  ) {
    super(message)
    this.name = 'ManualDepositError'
  }
}

/** A booking's manual guest deposits (never a PayOS link, never a staff payment). */
export const MANUAL_DEPOSIT_WHERE = {
  paymentGateway: null,
  AND: [{ metadata: { path: ['guestDeposit'], equals: true } }, { metadata: { path: ['manual'], equals: true } }],
} satisfies Prisma.PaymentWhereInput

/** A payment's metadata as an object (Prisma gives any JSON). */
export function metaOf(metadata: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Prisma.JsonObject) : {}
}

/** The deadline of a manual deposit; null = none (the hotel cancels by hand). */
export function manualDeadline(payment: { metadata: Prisma.JsonValue; expiresAt: Date | null }): Date | null {
  const m = metaOf(payment.metadata)
  if (m.autoCancel !== true) return null
  return typeof m.deadline === 'string' ? new Date(m.deadline) : payment.expiresAt
}

/** "Vietcombank", "MoMo"; the saved name for a bank not in the list. */
export function receivingName(bankCode: string | null, bankName?: string | null): string {
  return findBank(bankCode)?.shortName ?? bankName ?? bankCode ?? ''
}

/**
 * Records the manual deposit of a booking just made (or paid again): a
 * PENDING payment naming the hotel's receiving account, with the VietQR to
 * pay it. null when the hotel has no receiving account any more (the
 * booking stands; the hotel calls the guest).
 */
export async function createManualDeposit(
  booking: { id: string; propertyId: string; bookingCode: string },
  deposit: { amount: number; percent: number; deadline: Date | null; deadlineMinutes: number; retryOf?: string }
): Promise<{ amount: number; checkoutUrl: null; expiresAt: Date | null } | null> {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: booking.propertyId },
    select: {
      city: true,
      depositAccountId: true,
      bankAccounts: {
        where: { isActive: true, qrEnabled: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, bankCode: true, bankName: true, accountNumber: true, accountHolder: true },
      },
    },
  })
  const accountId = depositAccountIdFrom(property)
  const account = property.bankAccounts.find((a) => a.id === accountId)
  if (!account) return null

  const { amount, deadline } = deposit
  const qr = buildVietQr({
    bankCode: account.bankCode,
    accountNumber: account.accountNumber,
    accountHolder: account.accountHolder,
    amount,
    addInfo: booking.bookingCode,
    merchantCity: property.city,
  })

  await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        bookingId: booking.id,
        propertyId: booking.propertyId,
        amount,
        netAmount: amount,
        method: 'QR_VIETQR',
        status: 'PENDING',
        bankCode: account.bankCode,
        bankAccount: account.accountNumber,
        accountHolder: account.accountHolder,
        transferContent: booking.bookingCode,
        qrCodeUrl: qr,
        expiresAt: deadline,
        metadata: {
          guestDeposit: true,
          manual: true,
          percent: deposit.percent,
          bankName: receivingName(account.bankCode, account.bankName),
          ...(isWallet(account.bankCode) && { wallet: true }),
          ...(deadline && { autoCancel: true, deadlineMinutes: deposit.deadlineMinutes, deadline: deadline.toISOString() }),
          ...(deposit.retryOf && { retryOf: deposit.retryOf }),
        },
      },
    })
    await tx.activityLog.create({
      data: {
        propertyId: booking.propertyId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: created.id,
        metadata: { bookingCode: booking.bookingCode, method: 'MANUAL_TRANSFER', amount, by: 'guest', depositPercent: deposit.percent },
      },
    })
  })
  return { amount, checkoutUrl: null, expiresAt: deadline }
}

export interface TransferClaim {
  claimedAt: Date
  /** the deadline after the claim; null = none */
  deadline: Date | null
  /** true: the booking was claimed before; nothing changed, nobody was told again */
  already: boolean
  /** the front desk's emails, to send after the response */
  emailIds: string[]
}

/** "14:05 27/10/2026" in Vietnam time (staff read it in Vietnamese emails). */
function vnTime(date: Date): string {
  const d = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())} ${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

/**
 * The guest says they transferred their manual deposit. Once per booking:
 * extends the deadline by CLAIM_EXTENSION_MINUTES (if it has one and it has
 * not passed) and tells the front desk; a second call answers with the
 * first claim and does nothing. Refused once the booking no longer waits
 * for this deposit, or after the deadline.
 */
export async function claimTransfer(bookingId: string, now = new Date()): Promise<TransferClaim> {
  return prisma.$transaction(async (tx) => {
    await lockBooking(tx, bookingId)
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        propertyId: true,
        bookingCode: true,
        guestName: true,
        guestPhone: true,
        transferClaimedAt: true,
        property: {
          select: {
            name: true,
            isActive: true,
            workspace: {
              select: {
                slug: true,
                owner: { select: { email: true, name: true } },
                // The front desk, as for the bell (notifications.ts).
                members: { where: { role: { in: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] } }, select: { user: { select: { email: true, name: true } } } },
              },
            },
          },
        },
        payments: {
          where: MANUAL_DEPOSIT_WHERE,
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, amount: true, expiresAt: true, metadata: true, bankCode: true, bankAccount: true, accountHolder: true },
        },
      },
    })
    if (!booking || !booking.property.isActive) throw new ManualDepositError('Không tìm thấy đặt phòng', 404)
    const payment = booking.payments[0]
    if (!payment) throw new ManualDepositError('Đặt phòng này không đặt cọc bằng chuyển khoản')
    if (booking.transferClaimedAt) {
      return { claimedAt: booking.transferClaimedAt, deadline: manualDeadline(payment), already: true, emailIds: [] }
    }
    if (booking.status !== 'PENDING' || payment.status !== 'PENDING') throw new ManualDepositError('Đặt phòng này không còn chờ đặt cọc')
    const deadline = manualDeadline(payment)
    if (deadline && deadline.getTime() <= now.getTime()) throw new ManualDepositError('Đã quá hạn đặt cọc cho đặt phòng này')

    await tx.booking.update({ where: { id: booking.id }, data: { transferClaimedAt: now } })
    const extended = deadline ? new Date(deadline.getTime() + CLAIM_EXTENSION_MINUTES * 60_000) : null
    if (extended) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          expiresAt: extended,
          metadata: { ...metaOf(payment.metadata), deadline: extended.toISOString(), extendedAt: now.toISOString(), extendedMinutes: CLAIM_EXTENSION_MINUTES },
        },
      })
    }
    await tx.activityLog.create({
      data: {
        propertyId: booking.propertyId,
        action: 'TRANSFER_CLAIMED',
        entityType: 'BOOKING',
        entityId: booking.id,
        metadata: {
          bookingCode: booking.bookingCode,
          by: 'guest',
          paymentId: payment.id,
          amount: payment.amount,
          ...(deadline && extended && { deadline: deadline.toISOString(), extendedTo: extended.toISOString() }),
        },
      },
    })
    await notifyTransferClaimed(tx, {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      amount: payment.amount,
      claimedAt: now,
    })

    // The owner and the front desk, each once.
    const workspace = booking.property.workspace
    const people = new Map<string, string | undefined>()
    for (const person of [workspace.owner, ...workspace.members.map((m) => m.user)]) {
      if (person?.email && !people.has(person.email.toLowerCase())) people.set(person.email.toLowerCase(), person.name ?? undefined)
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const emailIds: string[] = []
    for (const [email, name] of people) {
      emailIds.push(
        await queueTransferClaimed(
          {
            toEmail: email,
            toName: name,
            bookingCode: booking.bookingCode,
            guestName: booking.guestName,
            guestPhone: booking.guestPhone,
            propertyName: booking.property.name,
            amount: payment.amount,
            claimedAt: vnTime(now),
            account: `${receivingName(payment.bankCode)} ${payment.bankAccount ?? ''} (${payment.accountHolder ?? ''})`.trim(),
            holdUntil: extended ? vnTime(extended) : null,
            manageUrl: `${site}/workspace/${workspace.slug}/properties/${booking.propertyId}/bookings/${booking.id}`,
          },
          booking.id,
          tx
        )
      )
    }
    return { claimedAt: now, deadline: extended, already: false, emailIds }
  })
}
