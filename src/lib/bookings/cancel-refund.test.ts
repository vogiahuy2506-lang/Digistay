import { describe, it, expect } from 'vitest'
import { suggestRefund } from './cancel-refund'

const HOUR = 60 * 60 * 1000
const now = new Date('2026-10-24T03:00:00Z')
const checkIn = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * HOUR)
const base = { now, status: 'CONFIRMED', totalPaid: 1_000_000, cancellationHours: 24, lateCancelRefundPercent: 0 }

describe('suggestRefund', () => {
  it('refunds everything when cancelled before the free-cancellation window', () => {
    expect(suggestRefund({ ...base, checkInDate: checkIn(24) })).toMatchObject({ rule: 'free', suggested: 1_000_000, percent: 100, hoursBefore: 24 })
  })

  it("inside the window, refunds the hotel's late-cancellation share (nothing by default)", () => {
    expect(suggestRefund({ ...base, checkInDate: checkIn(23.5) })).toMatchObject({ rule: 'late', suggested: 0, percent: 0, hoursBefore: 23 })
    expect(suggestRefund({ ...base, checkInDate: checkIn(5), lateCancelRefundPercent: 50 })).toMatchObject({ rule: 'late', suggested: 500_000, percent: 50 })
  })

  it('an empty window means no free cancellation, as the policy page says', () => {
    const r = suggestRefund({ ...base, checkInDate: checkIn(24 * 30), cancellationHours: null, lateCancelRefundPercent: 30 })
    expect(r).toMatchObject({ rule: 'late', suggested: 300_000, freeHours: null })
  })

  it('suggests nothing once the guest has checked in, or when nothing was paid', () => {
    expect(suggestRefund({ ...base, checkInDate: checkIn(-3), status: 'CHECKED_IN' })).toMatchObject({ rule: 'checkedIn', suggested: 0 })
    expect(suggestRefund({ ...base, checkInDate: checkIn(72), totalPaid: 0 })).toMatchObject({ rule: 'nothingPaid', suggested: 0 })
  })

  it('keeps the share between 0 and 100% and rounds to the dong', () => {
    expect(suggestRefund({ ...base, checkInDate: checkIn(1), lateCancelRefundPercent: 150 }).suggested).toBe(1_000_000)
    expect(suggestRefund({ ...base, checkInDate: checkIn(1), lateCancelRefundPercent: -5 }).suggested).toBe(0)
    expect(suggestRefund({ ...base, checkInDate: checkIn(1), totalPaid: 333_333, lateCancelRefundPercent: 50 }).suggested).toBe(166_667)
  })
})
