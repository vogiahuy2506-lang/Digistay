import { describe, it, expect } from 'vitest'
import { parseStayDatesFromText, formatVnDate, addDays } from './room-finder'

describe('AI Natural Language Stay Date & Guest Parser', () => {
  // Reference date: Wednesday 2026-11-04
  const refDate = new Date(2026, 10, 4) // Months are 0-indexed, so 10 = November

  it('correctly parses "cuối tuần này cho 2 người lớn"', () => {
    const res = parseStayDatesFromText('Cuối tuần này có phòng cho 2 người lớn không?', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.adults).toBe(2)
    expect(res.children).toBe(0)
    expect(res.hasExplicitDates).toBe(true)
    // Friday of that week is Nov 6, Sunday is Nov 8
    expect(res.checkIn).toBe('2026-11-06')
    expect(res.checkOut).toBe('2026-11-08')
  })

  it('correctly parses "ngày mai có phòng đơn cho 1 người không"', () => {
    const res = parseStayDatesFromText('Ngày mai có phòng đơn cho 1 người không em?', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.adults).toBe(1)
    expect(res.children).toBe(0)
    expect(res.checkIn).toBe('2026-11-05')
    expect(res.checkOut).toBe('2026-11-06')
  })

  it('correctly parses explicit date range with adults and children', () => {
    const res = parseStayDatesFromText('Mình muốn đặt phòng từ 15/11 đến 18/11 cho 3 người lớn và 1 trẻ em', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.adults).toBe(3)
    expect(res.children).toBe(1)
    expect(res.checkIn).toBe('2026-11-15')
    expect(res.checkOut).toBe('2026-11-18')
  })

  it('correctly prioritizes explicit dates over relative "cuối tuần này (14-15/11)"', () => {
    const res = parseStayDatesFromText('Cuối tuần này (14-15/11) còn phòng cho 2 người lớn không', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.adults).toBe(2)
    expect(res.children).toBe(0)
    expect(res.hasExplicitDates).toBe(true)
    expect(res.checkIn).toBe('2026-11-14')
    expect(res.checkOut).toBe('2026-11-15')
  })

  it('correctly parses short date range "14-15/11"', () => {
    const res = parseStayDatesFromText('14-15/11 còn phòng không bạn ơi?', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.checkIn).toBe('2026-11-14')
    expect(res.checkOut).toBe('2026-11-15')
    expect(res.hasExplicitDates).toBe(true)
  })

  it('correctly parses "14 - 15 tháng 11 cho 2 lớn 1 nhỏ"', () => {
    const res = parseStayDatesFromText('Đặt phòng 14 - 15 tháng 11 cho 2 lớn 1 nhỏ', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.adults).toBe(2)
    expect(res.children).toBe(1)
    expect(res.checkIn).toBe('2026-11-14')
    expect(res.checkOut).toBe('2026-11-15')
    expect(res.hasExplicitDates).toBe(true)
  })

  it('correctly parses "thứ 7 tuần sau" and "thứ bảy tuần sau"', () => {
    const resSat = parseStayDatesFromText('thứ 7 tuần sau còn phòng không?', refDate)
    expect(resSat.isRoomInquiry).toBe(true)
    expect(resSat.checkIn).toBe('2026-11-14')
    expect(resSat.checkOut).toBe('2026-11-15')

    const resBay = parseStayDatesFromText('thứ bảy tuần sau có phòng cho 2 khách không?', refDate)
    expect(resBay.isRoomInquiry).toBe(true)
    expect(resBay.checkIn).toBe('2026-11-14')
    expect(resBay.checkOut).toBe('2026-11-15')
  })

  it('correctly parses single date inquiry with 1 night stay', () => {
    const res = parseStayDatesFromText('Ngày 20/11 có phòng trống không?', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.checkIn).toBe('2026-11-20')
    expect(res.checkOut).toBe('2026-11-21')
    expect(res.hasExplicitDates).toBe(true)
  })

  it('correctly parses English query "room for 2 adults next weekend"', () => {
    const res = parseStayDatesFromText('Is there any room for 2 adults next weekend?', refDate)
    expect(res.isRoomInquiry).toBe(true)
    expect(res.adults).toBe(2)
    expect(res.hasExplicitDates).toBe(true)
    // Next weekend starts Friday Nov 13, check out Sunday Nov 15
    expect(res.checkIn).toBe('2026-11-13')
    expect(res.checkOut).toBe('2026-11-15')
  })
})

