import { describe, it, expect } from 'vitest'
import { addDays, currentSpan, isDay, nightStart, nightsOutsideType, planNumbers, roomPlan, spanOnNight, vnDay, withNightsIn, type RoomSpan } from './room-plan'

/** Vietnam midnight of a day, the way staff bookings store it. */
const at = (day: string) => new Date(`${day}T00:00:00+07:00`)
const room = (number: string, roomTypeId = 'std') => ({ roomId: `r${number}`, roomNumber: number, roomTypeId })
/** "101 10–12": a plan in a line, Vietnam days of December. */
const show = (plan: RoomSpan[]) => plan.map((s) => `${s.roomNumber} ${vnDay(s.from).slice(8)}–${vnDay(s.to).slice(8)}`)

const stay = { checkInDate: at('2026-12-10'), checkOutDate: at('2026-12-14') }
const whole = roomPlan({ ...stay, bookingItems: [room('101')] })

describe('days', () => {
  it('reads Vietnam days and real dates only', () => {
    expect(vnDay('2026-12-09T17:00:00Z')).toBe('2026-12-10')
    expect(vnDay('2026-12-09T16:59:59Z')).toBe('2026-12-09')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(isDay('2026-12-12')).toBe(true)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('12/12/2026')).toBe(false)
  })

  it("starts a night at the stay's check-in time of day", () => {
    expect(nightStart(at('2026-12-10'), '2026-12-12')).toEqual(at('2026-12-12'))
    // A site booking checks in at 07:00 Vietnam time (UTC midnight): its nights do too.
    expect(nightStart('2026-12-10T00:00:00Z', '2026-12-12')).toEqual(new Date('2026-12-12T00:00:00Z'))
  })
})

describe('roomPlan', () => {
  it("is one span in the item's room until the stay is split, then its segments in night order", () => {
    expect(show(whole)).toEqual(['101 10–14'])
    const split = roomPlan({
      ...stay,
      bookingItems: [room('101')],
      roomSegments: [
        { ...room('205', 'dlx'), roomNumber: '205', fromDate: '2026-12-11T17:00:00.000Z', toDate: '2026-12-13T17:00:00.000Z' },
        { ...room('101'), roomNumber: '101', fromDate: '2026-12-09T17:00:00.000Z', toDate: '2026-12-11T17:00:00.000Z' },
      ],
    })
    expect(show(split)).toEqual(['101 10–12', '205 12–14'])
    expect(roomPlan({ ...stay, bookingItems: [] })).toEqual([])
  })
})

describe('the room of a night', () => {
  const split = withNightsIn(whole, at('2026-12-12'), at('2026-12-14'), room('205'))

  it('finds the span of each night; the check-out day is no night', () => {
    expect(spanOnNight(split, '2026-12-11')?.roomNumber).toBe('101')
    expect(spanOnNight(split, '2026-12-12')?.roomNumber).toBe('205')
    expect(spanOnNight(split, '2026-12-14')).toBeNull()
  })

  it("shows tonight's room in house, the first before arrival, the last after", () => {
    expect(currentSpan(split, '2026-12-01')?.roomNumber).toBe('101')
    expect(currentSpan(split, '2026-12-13')?.roomNumber).toBe('205')
    expect(currentSpan(split, '2026-12-14')?.roomNumber).toBe('205')
    expect(currentSpan([], '2026-12-13')).toBeNull()
  })
})

describe('withNightsIn', () => {
  it('splits from a date, cuts out a middle part, and merges neighbours in one room', () => {
    const fromTwelfth = withNightsIn(whole, at('2026-12-12'), at('2026-12-14'), room('205'))
    expect(show(fromTwelfth)).toEqual(['101 10–12', '205 12–14'])
    const middle = withNightsIn(whole, at('2026-12-11'), at('2026-12-13'), room('102'))
    expect(show(middle)).toEqual(['101 10–11', '102 11–13', '101 13–14'])
    // Back to the room the stay is in around it: one span again.
    expect(show(withNightsIn(middle, at('2026-12-11'), at('2026-12-13'), room('101')))).toEqual(['101 10–14'])
    expect(show(withNightsIn(fromTwelfth, stay.checkInDate, stay.checkOutDate, room('301')))).toEqual(['301 10–14'])
  })

  it('never merges two rooms with one number (a renamed or deleted room)', () => {
    const gone = [{ ...whole[0], roomId: null }]
    expect(withNightsIn(gone, at('2026-12-12'), at('2026-12-14'), room('101'))).toHaveLength(2)
  })
})

describe('nightsOutsideType', () => {
  it('gives the runs of nights a room of that type would take from another', () => {
    const plan = withNightsIn(whole, at('2026-12-11'), at('2026-12-12'), room('301', 'dlx'))
    expect(nightsOutsideType(plan, stay.checkInDate, stay.checkOutDate, 'dlx').map((r) => [vnDay(r.from), vnDay(r.to)])).toEqual([
      ['2026-12-10', '2026-12-11'],
      ['2026-12-12', '2026-12-14'],
    ])
    expect(nightsOutsideType(plan, at('2026-12-12'), at('2026-12-14'), 'std')).toEqual([])
    // Spans of other types next to each other make one run.
    const three = withNightsIn(plan, at('2026-12-12'), at('2026-12-13'), room('401', 'fam'))
    expect(nightsOutsideType(three, at('2026-12-11'), at('2026-12-14'), 'std').map((r) => [vnDay(r.from), vnDay(r.to)])).toEqual([['2026-12-11', '2026-12-13']])
  })
})

describe('planNumbers', () => {
  it('reads "101 → 205" for a split stay, one number or nothing otherwise', () => {
    expect(planNumbers(withNightsIn(whole, at('2026-12-12'), at('2026-12-14'), room('205')))).toBe('101 → 205')
    expect(planNumbers(whole)).toBe('101')
    expect(planNumbers([{ ...whole[0], roomId: null, roomNumber: null }])).toBe('')
  })
})
