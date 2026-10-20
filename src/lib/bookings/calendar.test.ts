import { describe, it, expect } from 'vitest'
import { CALENDAR_FETCH_MARGIN_DAYS, csvCell, fetchWindow, staysNight, toCsv } from './calendar'

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
