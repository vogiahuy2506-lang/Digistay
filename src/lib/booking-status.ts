import type { BookingStatus, PaymentStatus } from '@prisma/client'

/**
 * Labels and colors for booking and payment states, shared by every screen
 * (redesign system page 1c). `Record<Enum, ...>` makes tsc fail when Prisma
 * gains a state nobody has designed yet.
 */

export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'refund' | 'plain'

export interface StatusMeta {
  label: string
  tone: StatusTone
  /** Finished without happening (cancelled): drawn struck through. */
  struck?: boolean
  /** Staff has to do something; the bookings list only colors these. */
  needsAction?: boolean
}

export const bookingStatusMeta: Record<BookingStatus, StatusMeta> = {
  PENDING: { label: 'Chờ thanh toán', tone: 'warn', needsAction: true },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'info' },
  CHECKED_IN: { label: 'Đã nhận phòng', tone: 'ok' },
  CHECKED_OUT: { label: 'Đã trả phòng', tone: 'plain' },
  CANCELLED: { label: 'Đã hủy', tone: 'plain', struck: true },
  NO_SHOW: { label: 'Không đến', tone: 'err' },
}

export const paymentStatusMeta: Record<PaymentStatus, StatusMeta> = {
  PENDING: { label: 'Chưa thanh toán', tone: 'warn', needsAction: true },
  PROCESSING: { label: 'Đang xử lý', tone: 'info' },
  PAID: { label: 'Đã thanh toán', tone: 'ok' },
  PARTIAL: { label: 'Đã cọc', tone: 'info' },
  FAILED: { label: 'Thất bại', tone: 'err', needsAction: true },
  REFUNDED: { label: 'Hoàn tiền', tone: 'refund' },
  CANCELLED: { label: 'Đã hủy', tone: 'plain', struck: true },
  EXPIRED: { label: 'Hết hạn', tone: 'plain', needsAction: true },
}

const unknownStatus: StatusMeta = { label: 'Không rõ', tone: 'plain' }

/** For values that come from JSON (typed as string): unknown ones get a neutral chip. */
export function getBookingStatusMeta(status: string): StatusMeta {
  return Object.prototype.hasOwnProperty.call(bookingStatusMeta, status) ? bookingStatusMeta[status as BookingStatus] : unknownStatus
}

export function getPaymentStatusMeta(status: string): StatusMeta {
  return Object.prototype.hasOwnProperty.call(paymentStatusMeta, status) ? paymentStatusMeta[status as PaymentStatus] : unknownStatus
}
