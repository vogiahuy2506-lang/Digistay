import { describe, it, expect } from 'vitest'
import {
  buildPrintHtml,
  escapeHtml,
  formatDateTime,
  formatDayMonth,
  formatLongDate,
  formatVnd,
  guestsLabel,
  nightsBetween,
  paymentLine,
  sourceLabel,
} from './display'

describe('booking display helpers', () => {
  it('counts calendar nights in Vietnam time', () => {
    // 14:00 VN check-in, 12:00 VN check-out two days later.
    expect(nightsBetween('2026-11-01T07:00:00Z', '2026-11-03T05:00:00Z')).toBe(2)
    // 23:30 VN on the 1st is still the 1st; 00:30 VN on the 2nd is the next day.
    expect(nightsBetween('2026-11-01T16:30:00Z', '2026-11-01T17:30:00Z')).toBe(1)
    expect(nightsBetween('2026-11-03T05:00:00Z', '2026-11-01T07:00:00Z')).toBe(0)
  })

  it('formats dates in Vietnam time with Vietnamese weekdays', () => {
    // 17:30 UTC on Oct 25 is 00:30 on Monday Oct 26 in Vietnam.
    expect(formatDayMonth('2026-10-25T17:30:00Z')).toBe('26/10')
    expect(formatLongDate('2026-10-25T17:30:00Z')).toBe('Thứ Hai, 26/10/2026')
    expect(formatLongDate('2026-10-25T00:00:00Z')).toBe('Chủ Nhật, 25/10/2026')
    expect(formatDateTime('2026-10-19T14:40:00Z')).toBe('19/10/2026 21:40')
  })

  it('keeps the ₫ on the same line as the number', () => {
    expect(formatVnd(4_350_000)).toMatch(/^4\.350\.000 ₫$/)
  })

  it('labels sources and guests', () => {
    expect(sourceLabel('DIRECT')).toBe('Website')
    expect(sourceLabel('AGENT')).toBe('Đại lý')
    expect(sourceLabel('SOMETHING')).toBe('SOMETHING')
    expect(guestsLabel(2, 0)).toBe('2 người lớn')
    expect(guestsLabel(2, 1)).toBe('2 người lớn · 1 trẻ em')
  })

  it('colors the payment line only when staff must act', () => {
    const base = { totalAmount: 4_350_000, depositAmount: 1_305_000, status: 'CONFIRMED' }
    expect(paymentLine({ ...base, paymentStatus: 'PARTIAL' })).toEqual({
      text: `Đã cọc · còn ${formatVnd(3_045_000)}`,
      tone: null,
    })
    expect(paymentLine({ ...base, paymentStatus: 'PAID' }).tone).toBeNull()
    expect(paymentLine({ ...base, paymentStatus: 'PENDING' }).tone).toBe('warn')
    expect(paymentLine({ ...base, paymentStatus: 'EXPIRED' }).tone).toBe('warn')
    expect(paymentLine({ ...base, paymentStatus: 'FAILED' }).tone).toBe('err')
    // A cancelled booking owes nothing, so its unpaid state is not a to-do.
    expect(paymentLine({ ...base, status: 'CANCELLED', paymentStatus: 'PENDING' }).tone).toBeNull()
  })

  it('never shows a negative remaining amount', () => {
    expect(paymentLine({ totalAmount: 100, depositAmount: 500, status: 'CONFIRMED', paymentStatus: 'PARTIAL' }).text).toBe(
      `Đã cọc · còn ${formatVnd(0)}`
    )
  })

  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
    )
    expect(escapeHtml(null)).toBe('')
  })

  it('builds a print slip with guest data escaped (no script from the public booking form)', () => {
    const html = buildPrintHtml({
      bookingCode: 'MB-1<b>',
      guestName: '<img src=x onerror=alert(document.cookie)>',
      guestPhone: '0912"345',
      guestEmail: 'a@b.vn</td><script>alert(1)</script>',
      checkInDate: '2026-11-01T07:00:00Z',
      checkOutDate: '2026-11-03T05:00:00Z',
      numAdults: 2,
      numChildren: 1,
      totalAmount: 3_140_000,
      depositAmount: 942_000,
      roomLabel: 'Deluxe · 206',
      property: { name: 'Mây <Biển>', address: null, phone: '0256' },
    })
    expect(html).not.toMatch(/<img|<script|<b>|<Biển>/)
    expect(html).toContain('&lt;img src=x onerror=alert(document.cookie)&gt;')
    expect(html).toContain('2 đêm')
    expect(html).toContain('2 người lớn · 1 trẻ em')
    expect(html).toContain(formatVnd(2_198_000))
    expect(html).not.toContain('Địa chỉ')
  })
})
