/**
 * The dashboard's bell (task 30): in-app notices for the people running a
 * hotel, next to the owner's email. Written in the same transaction as what
 * they announce, one row per recipient; the bell (notification-bell.tsx)
 * reads them through /api/notifications every half minute.
 *
 * - booking_new: a guest booked on the hotel's site → the owner, admins,
 *   managers and receptionists; staff made one → the owner and admins, not
 *   whoever made it.
 * - deposit_paid: a guest's online deposit came in (PayOS) → the
 *   owner, admins, managers and receptionists.
 *
 * Stored as a type and data, so each reader sees it in their own language.
 */
import type { Prisma, WorkspaceRole } from '@prisma/client'

type Tx = Prisma.TransactionClient

export const NOTIFICATION_TYPES = ['booking_new', 'deposit_paid'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

const FRONT_DESK: WorkspaceRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST']

async function notify(
  tx: Tx,
  input: {
    propertyId: string
    bookingId: string
    type: NotificationType
    roles: WorkspaceRole[]
    exceptUserId?: string | null
    data: Prisma.JsonObject
  }
): Promise<number> {
  const property = await tx.property.findUniqueOrThrow({
    where: { id: input.propertyId },
    select: {
      name: true,
      workspaceId: true,
      workspace: { select: { slug: true, ownerId: true, members: { where: { role: { in: input.roles }, planLockedAt: null }, select: { userId: true } } } },
    },
  })
  const recipients = new Set([property.workspace.ownerId, ...property.workspace.members.map((m) => m.userId)])
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
    roles: fromWebsite ? FRONT_DESK : ['ADMIN'],
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
    roles: FRONT_DESK,
    data: { bookingCode: booking.bookingCode, guestName: booking.guestName, amount: payment.amount },
  })
}
