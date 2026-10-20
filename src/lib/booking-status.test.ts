import { describe, it, expect } from 'vitest'
import { BookingStatus, PaymentStatus } from '@prisma/client'
import { bookingStatusMeta, getBookingStatusMeta, getPaymentStatusMeta, paymentStatusMeta } from './booking-status'

describe('booking status labels', () => {
  it('covers every Prisma booking and payment state', () => {
    expect(Object.keys(bookingStatusMeta).sort()).toEqual(Object.values(BookingStatus).sort())
    expect(Object.keys(paymentStatusMeta).sort()).toEqual(Object.values(PaymentStatus).sort())
  })

  it('uses the wording and colors from the design', () => {
    expect(bookingStatusMeta.CONFIRMED).toEqual({ label: 'Đã xác nhận', tone: 'info' })
    expect(bookingStatusMeta.CHECKED_IN).toEqual({ label: 'Đã nhận phòng', tone: 'ok' })
    expect(bookingStatusMeta.NO_SHOW).toEqual({ label: 'Không đến', tone: 'err' })
    expect(paymentStatusMeta.PARTIAL).toEqual({ label: 'Đã cọc', tone: 'info' })
    expect(paymentStatusMeta.REFUNDED).toEqual({ label: 'Hoàn tiền', tone: 'refund' })
  })

  it('strikes through cancelled states only', () => {
    const struck = [...Object.entries(bookingStatusMeta), ...Object.entries(paymentStatusMeta)]
      .filter(([, meta]) => meta.struck)
      .map(([status]) => status)
    expect(struck).toEqual(['CANCELLED', 'CANCELLED'])
  })

  it('flags the payment states staff must act on', () => {
    const action = Object.entries(paymentStatusMeta)
      .filter(([, meta]) => meta.needsAction)
      .map(([status]) => status)
      .sort()
    expect(action).toEqual(['EXPIRED', 'FAILED', 'PENDING'])
  })

  it('never uses the error tone for a state that is not a problem', () => {
    const errStates = [...Object.entries(bookingStatusMeta), ...Object.entries(paymentStatusMeta)]
      .filter(([, meta]) => meta.tone === 'err')
      .map(([status]) => status)
      .sort()
    expect(errStates).toEqual(['FAILED', 'NO_SHOW'])
  })

  it('falls back to a neutral chip for unknown strings, including prototype keys', () => {
    for (const value of ['', 'SOMETHING_NEW', 'toString', '__proto__', 'constructor']) {
      expect(getBookingStatusMeta(value)).toEqual({ label: 'Không rõ', tone: 'plain' })
      expect(getPaymentStatusMeta(value)).toEqual({ label: 'Không rõ', tone: 'plain' })
    }
    expect(getPaymentStatusMeta('PAID').label).toBe('Đã thanh toán')
  })
})
