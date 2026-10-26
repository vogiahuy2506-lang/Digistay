import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  CALENDAR_FETCH_MARGIN_DAYS,
  arrivalsOn,
  csvCell,
  dayKey,
  departuresOn,
  fetchBookingsAround,
  fetchWindow,
  inHouse,
  monthArrivals,
  monthOccupancy,
  nightOccupancy,
  roomOn,
  staysNight,
  toCsv,
  type CalendarBooking,
} from './calendar'

const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h)

describe('staysNight', () => {
  const stay = { checkInDate: local(2026, 10, 20, 14), checkOutDate: local(2026, 10, 22, 12) }

  it('counts the nights from check-in up to, not including, check-out', () => {
    expect(staysNight(stay, local(2026, 10, 19))).toBe(false)
    expect(staysNight(stay, local(2026, 10, 20))).toBe(true)
    expect(staysNight(stay, local(2026, 10, 21))).toBe(true)
    expect(staysNight(stay, local(2026, 10, 22))).toBe(false) // check-out day: the room is free that night
  })

  it('works across the end of a month', () => {
    const crossing = { checkInDate: local(2026, 10, 31), checkOutDate: local(2026, 11, 2) }
    expect(staysNight(crossing, local(2026, 10, 31))).toBe(true)
    expect(staysNight(crossing, local(2026, 11, 1))).toBe(true)
    expect(staysNight(crossing, local(2026, 11, 2))).toBe(false)
  })
})

describe('fetchWindow', () => {
  it('widens the days shown on both sides', () => {
    const { startDate, endDate } = fetchWindow(local(2026, 9, 28), local(2026, 11, 9))
    const days = (iso: string, d: Date) => Math.round((new Date(iso).getTime() - d.getTime()) / 86400000)
    expect(days(startDate, local(2026, 9, 28))).toBe(-CALENDAR_FETCH_MARGIN_DAYS)
    expect(days(endDate, local(2026, 11, 9))).toBe(CALENDAR_FETCH_MARGIN_DAYS)
  })
})

describe('csv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Nguyễn Văn A')).toBe('Nguyễn Văn A')
    expect(csvCell('Trần, Thị B')).toBe('"Trần, Thị B"')
    expect(csvCell('nói "xin chào"')).toBe('"nói ""xin chào"""')
    expect(csvCell('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"')
    expect(csvCell(null)).toBe('')
  })

  it('keeps formulas from running in a spreadsheet', () => {
    expect(csvCell('=HYPERLINK("http://x","bấm")')).toBe('"\'=HYPERLINK(""http://x"",""bấm"")"')
    expect(csvCell('+84912345678')).toBe("'+84912345678")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('joins rows with CRLF', () => {
    expect(toCsv([['Mã', 'Khách'], ['DS1', 'A, B']])).toBe('Mã,Khách\r\nDS1,"A, B"')
  })
})

/** A booking in room type `type`, local days of 2026 (month 1-12), noon so the Vietnam day is the same in any test zone. */
function booking(
  id: string,
  [m1, d1]: [number, number],
  [m2, d2]: [number, number],
  extra: Partial<CalendarBooking> & { id?: string; type?: string } = {}
): CalendarBooking & { id: string } {
  const { type = 'std', ...rest } = extra
  return {
    id,
    status: 'CONFIRMED',
    checkInDate: local(2026, m1, d1, 12),
    checkOutDate: local(2026, m2, d2, 12),
    numAdults: 2,
    numChildren: 0,
    totalAmount: 1_000_000,
    bookingItems: [{ roomTypeId: type, roomNumber: null }],
    ...rest,
  }
}

describe('figures of a day and a month', () => {
  it('counts the rooms taken a night per room type, without cancelled, no-show or departing stays', () => {
    const night = local(2026, 10, 21)
    const taken = nightOccupancy(
      [
        booking('a', [10, 20], [10, 23]),
        booking('b', [10, 21], [10, 22], { type: 'dlx' }),
        booking('c', [10, 19], [10, 21]), // checks out that day: the room is free that night
        booking('d', [10, 21], [10, 22], { status: 'CANCELLED' }),
        booking('e', [10, 21], [10, 22], { status: 'NO_SHOW' }),
      ],
      night
    )
    expect(Object.fromEntries(taken)).toEqual({ std: 1, dlx: 1 })
  })

  it("counts a stay that changes rooms in that night's room type", () => {
    const split = booking('s', [10, 20], [10, 23], {
      bookingItems: [{ roomTypeId: 'std', roomNumber: '101' }],
      roomSegments: [
        { roomId: 'r101', roomNumber: '101', roomTypeId: 'std', fromDate: local(2026, 10, 20, 12), toDate: local(2026, 10, 21, 12) },
        { roomId: 'r205', roomNumber: '205', roomTypeId: 'dlx', fromDate: local(2026, 10, 21, 12), toDate: local(2026, 10, 23, 12) },
      ],
    })
    expect(Object.fromEntries(nightOccupancy([split], local(2026, 10, 20)))).toEqual({ std: 1 })
    expect(Object.fromEntries(nightOccupancy([split], local(2026, 10, 22)))).toEqual({ dlx: 1 })
    expect(roomOn(split, local(2026, 10, 20))).toBe('101')
    expect(roomOn(split, local(2026, 10, 22))).toBe('205')
    // The check-out day shows the last night's room.
    expect(roomOn(split, local(2026, 10, 23))).toBe('205')
  })

  it("takes the month's room-nights over the rooms the hotel has, in %", () => {
    // 2 rooms × 30 nights of November; 3 nights booked inside it, 1 more crossing from October.
    const bookings = [booking('a', [11, 10], [11, 13]), booking('b', [10, 31], [11, 2]), booking('c', [11, 5], [11, 9], { status: 'CANCELLED' })]
    expect(monthOccupancy(bookings, 2, 2026, 10)).toBeCloseTo((4 / 60) * 100)
    expect(monthOccupancy(bookings, 0, 2026, 10)).toBe(0)
  })

  it("sums the month's live bookings by arrival", () => {
    const bookings = [
      booking('a', [10, 3], [10, 5], { totalAmount: 2_000_000 }),
      booking('b', [10, 30], [11, 2], { status: 'PENDING', totalAmount: 1_500_000 }),
      booking('c', [10, 10], [10, 11], { status: 'CANCELLED', totalAmount: 9_000_000 }),
      booking('d', [9, 29], [10, 2], { totalAmount: 7_000_000 }), // arrived in September
      booking('e', [10, 12], [10, 13], { totalAmount: null }), // no amount for this role
    ]
    expect(monthArrivals(bookings, 2026, 9)).toEqual({ count: 3, pending: 1, total: 3_500_000 })
  })

  it("lists the day's arrivals and departures and who is in house", () => {
    const today = local(2026, 10, 27)
    const bookings = [
      booking('in1', [10, 27], [10, 28]),
      booking('in2', [10, 27], [10, 29], { status: 'PENDING' }),
      booking('gone', [10, 27], [10, 28], { status: 'CANCELLED' }),
      booking('here', [10, 25], [10, 27], { status: 'CHECKED_IN', numAdults: 2, numChildren: 1 }),
      booking('stay', [10, 26], [10, 30], { status: 'CHECKED_IN', numAdults: 1 }),
      booking('left', [10, 25], [10, 27], { status: 'CHECKED_OUT' }),
    ]
    expect(arrivalsOn(bookings, today).map((b) => b.id)).toEqual(['in1', 'in2'])
    expect(departuresOn(bookings, today).map((b) => b.id)).toEqual(['here'])
    expect(inHouse(bookings)).toEqual({ stays: 2, guests: 4 })
  })

  it('keys a local day as yyyy-mm-dd', () => {
    expect(dayKey(local(2026, 1, 5, 23))).toBe('2026-01-05')
  })
})

describe('fetchBookingsAround', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks the widened window and follows every page', async () => {
    const calls: URL[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      const u = new URL(url, 'http://localhost')
      calls.push(u)
      const page = Number(u.searchParams.get('page'))
      return { json: async () => ({ success: true, data: [{ id: `b${page}` }], pagination: { totalPages: 3 } }) }
    })
    const found = await fetchBookingsAround<{ id: string }>('p1', local(2026, 10, 1), local(2026, 11, 1))
    expect(found.map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    expect(calls[0].searchParams.get('propertyId')).toBe('p1')
    expect(calls[0].searchParams.get('limit')).toBe('100')
    expect(calls[0].searchParams.get('startDate')).toBe(fetchWindow(local(2026, 10, 1), local(2026, 11, 1)).startDate)
  })

  it('stops at 20 pages, and at a refused page', async () => {
    let asked = 0
    vi.stubGlobal('fetch', async () => {
      asked++
      return { json: async () => ({ success: true, data: [], pagination: { totalPages: 50 } }) }
    })
    await fetchBookingsAround('p1', local(2026, 10, 1), local(2026, 11, 1))
    expect(asked).toBe(20)

    vi.stubGlobal('fetch', async () => ({ json: async () => ({ success: false, error: 'Không có quyền truy cập' }) }))
    expect(await fetchBookingsAround('p1', local(2026, 10, 1), local(2026, 11, 1))).toEqual([])
  })
})
