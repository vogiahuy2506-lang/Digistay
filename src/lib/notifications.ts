/**
 * The dashboard's bell (task 30): in-app notices for the people running a
 * hotel, next to the owner's email. Written in the same transaction as what
 * they announce, one row per recipient; the bell (notification-bell.tsx)
 * reads them through /api/notifications every half minute.
 *
 * Recipients: the owner and the members with a permission at the property
 * (usersWithPermission in src/lib/auth/access.ts).
 * - booking_new: a guest booked on the hotel's site → bookings_edit (the
 *   front desk); staff made one → workspace_settings (the admins), not
 *   whoever made it.
 * - deposit_paid: a guest's online deposit came in (PayOS, or staff
 *   confirmed a manual transfer) → payments_manage.
 * - transfer_claimed: a guest says they transferred a manual deposit
 *   (manual-deposit.ts) → payments_manage, to check the account.
 *
 * Stored as a type and data, so each reader sees it in their own language.
 */
import type { Prisma } from '@prisma/client'
import { usersWithPermission } from '@/lib/auth/access'
import type { Permission } from '@/lib/auth/permissions'

type Tx = Prisma.TransactionClient

export const NOTIFICATION_TYPES = ['booking_new', 'deposit_paid', 'transfer_claimed'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

async function notify(
  tx: Tx,
  input: {
    propertyId: string
    bookingId: string
    type: NotificationType
    permission: Permission
    exceptUserId?: string | null
    data: Prisma.JsonObject
  }
): Promise<number> {
  const property = await tx.property.findUniqueOrThrow({
    where: { id: input.propertyId },
    select: {
      name: true,
      workspaceId: true,
      workspace: { select: { slug: true } },
    },
  })
  const recipients = new Set(await usersWithPermission(tx, input.propertyId, input.permission))
  if (input.exceptUserId) recipients.delete(input.exceptUserId)
  if (recipients.size === 0) return 0
  const link = `/workspace/${property.workspace.slug}/properties/${input.propertyId}/bookings/${input.bookingId}`
  const { count } = await tx.notification.createMany({
    data: [...recipients].map((userId) => ({
      userId,
      workspaceId: property.workspaceId,
      propertyId: input.propertyId,
      type: input.type,
      data: { ...input.data, propertyName: property.name },
      link,
    })),
  })
  return count
}

export function notifyNewBooking(
  tx: Tx,
  booking: {
    id: string
    propertyId: string
    bookingCode: string
    guestName: string
    checkInDate: Date
    checkOutDate: Date
    totalAmount: number
    createdById: string | null
  }
) {
  const fromWebsite = booking.createdById === null
  return notify(tx, {
    propertyId: booking.propertyId,
    bookingId: booking.id,
    type: 'booking_new',
    permission: fromWebsite ? 'bookings_edit' : 'workspace_settings',
    exceptUserId: booking.createdById,
    data: {
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      checkIn: booking.checkInDate.toISOString(),
      checkOut: booking.checkOutDate.toISOString(),
      total: booking.totalAmount,
      fromWebsite,
    },
  })
}

export async function notifyDepositPaid(tx: Tx, payment: { bookingId: string; amount: number }) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: payment.bookingId },
    select: { id: true, propertyId: true, bookingCode: true, guestName: true },
  })
  return notify(tx, {
    propertyId: booking.propertyId,
    bookingId: booking.id,
    type: 'deposit_paid',
    permission: 'payments_manage',
    data: { bookingCode: booking.bookingCode, guestName: booking.guestName, amount: payment.amount },
  })
}

/** A guest pressed "Tôi đã chuyển khoản": someone should look at the hotel's account. */
export function notifyTransferClaimed(
  tx: Tx,
  claim: { bookingId: string; propertyId: string; bookingCode: string; guestName: string; amount: number; claimedAt: Date }
) {
  return notify(tx, {
    propertyId: claim.propertyId,
    bookingId: claim.bookingId,
    type: 'transfer_claimed',
    permission: 'payments_manage',
    data: { bookingCode: claim.bookingCode, guestName: claim.guestName, amount: claim.amount, claimedAt: claim.claimedAt.toISOString() },
  })
}
