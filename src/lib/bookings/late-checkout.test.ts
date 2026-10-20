import { describe, it, expect } from 'vitest'
import { checkOutDeadline, lateCheckoutFee } from './late-checkout'

// A 2-night stay, 2.4M of room: 1.2M a night, so 25,000 per hour late.
const stay = {
  checkInDate: new Date('2026-12-07T00:00:00Z'),
  checkOutDate: new Date('2026-12-09T00:00:00Z'),
  subtotal: 2_400_000,
}

describe('checkOutDeadline', () => {
  it("is the hotel's check-out time on the booked day, Vietnam time, however the date was stored", () => {
    const noonVn = '2026-12-09T05:00:00.000Z'
    expect(checkOutDeadline(new Date('2026-12-09T00:00:00Z'), '12:00').toISOString()).toBe(noonVn) // yyyy-mm-dd
    expect(checkOutDeadline(new Date('2026-12-09T05:00:00Z'), '12:00').toISOString()).toBe(noonVn) // 12:00 VN
    expect(checkOutDeadline(new Date('2026-12-08T17:00:00Z'), '12:00').toISOString()).toBe(noonVn) // VN midnight
    expect(checkOutDeadline(new Date('2026-12-09T00:00:00Z'), '11:30').toISOString()).toBe('2026-12-09T04:30:00.000Z')
  })

  it('falls back to 12:00 when the policy time is missing or malformed', () => {
    for (const time of [null, undefined, '', 'noon', '25:00', '12:60']) {
      expect(checkOutDeadline(new Date('2026-12-09T00:00:00Z'), time).toISOString()).toBe('2026-12-09T05:00:00.000Z')
    }
  })
})

describe('lateCheckoutFee', () => {
  it('charges nothing up to the deadline, nor when the guest leaves a day early in the evening', () => {
    expect(lateCheckoutFee({ ...stay, now: new Date('2026-12-09T05:00:00Z') }).fee).toBe(0)
    // 19:00 VN the day before: the old code charged 7 hours here.
    expect(lateCheckoutFee({ ...stay, now: new Date('2026-12-08T12:00:00Z') }).fee).toBe(0)
  })

  it('charges half a night per 24 hours late, by the started hour', () => {
    expect(lateCheckoutFee({ ...stay, now: new Date('2026-12-09T08:00:00Z') })).toMatchObject({ hoursLate: 3, fee: 75_000 })
    expect(lateCheckoutFee({ ...stay, now: new Date('2026-12-09T05:01:00Z') })).toMatchObject({ hoursLate: 1, fee: 25_000 })
    expect(lateCheckoutFee({ ...stay, now: new Date('2026-12-09T08:00:00Z'), checkOutTime: '14:00' }).fee).toBe(25_000)
  })

  it('treats a same-day stay as one night', () => {
    const sameDay = { ...stay, checkInDate: stay.checkOutDate, subtotal: 1_200_000 }
    expect(lateCheckoutFee({ ...sameDay, now: new Date('2026-12-09T06:00:00Z') }).fee).toBe(25_000)
  })
})
