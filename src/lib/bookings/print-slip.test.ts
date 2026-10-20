import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/lib/utils/escape-html'
import { buildPrintSlipHtml, type PrintSlipBooking } from './print-slip'

const format = { date: (v: string) => `date(${v})`, money: (n: number) => `${n} ₫` }

const booking: PrintSlipBooking = {
  bookingCode: 'DS1',
  guestName: 'Nguyễn Văn An',
  guestPhone: '0905123456',
  guestEmail: 'an@example.com',
  checkInDate: '2026-11-01',
  checkOutDate: '2026-11-03',
  numAdults: 2,
  numChildren: 1,
  totalAmount: 3_140_000,
  depositAmount: 942_000,
  property: { name: 'Mây Biển', address: '28 Xuân Diệu', phone: '0256' },
}

describe('escapeHtml', () => {
  it('escapes the characters that open tags or attributes', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
    )
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('print slip', () => {
  it('keeps the slip content', () => {
    const html = buildPrintSlipHtml(booking, '203', format)
    for (const text of ['DS1', 'Nguyễn Văn An', '0905123456', 'an@example.com', 'date(2026-11-01)', '2 NL + 1 TE', '203', '3140000 ₫', 'Mây Biển']) {
      expect(html).toContain(text)
    }
    expect(buildPrintSlipHtml(booking, '', format)).toContain('Chưa gán')
  })

  it('prints guest data from the public booking form as text, never as markup', () => {
    const html = buildPrintSlipHtml(
      {
        ...booking,
        bookingCode: 'DS1</title><script>alert(1)</script>',
        guestName: '<img src=x onerror=alert(document.cookie)>',
        guestPhone: '<svg onload=alert(1)>',
        guestEmail: 'a@b.vn</td><script>alert(2)</script>',
        property: { name: '<b>Mây</b>', address: '<i>x</i>', phone: null },
      },
      '<script>alert(3)</script>',
      format
    )
    expect(html).not.toMatch(/<img|<svg|<script|<b>|<i>/)
    expect(html).toContain('&lt;img src=x onerror=alert(document.cookie)&gt;')
    expect(html).toContain('&lt;script&gt;alert(3)&lt;/script&gt;')
  })
})
