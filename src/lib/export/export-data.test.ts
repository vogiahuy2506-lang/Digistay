import { describe, it, expect } from 'vitest'
import { escapeCsvCell, generateCsv, generateExcelHtml } from './export-data'

describe('export-data utility', () => {
  it('escapes CSV cells with quotes and commas', () => {
    expect(escapeCsvCell('Hello')).toBe('Hello')
    expect(escapeCsvCell('Hello, World')).toBe('"Hello, World"')
    expect(escapeCsvCell('He said "Hi"')).toBe('"He said ""Hi"""')
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
    expect(escapeCsvCell(123)).toBe('123')
  })

  it('generates CSV with UTF-8 BOM', () => {
    const headers = ['Họ tên', 'Số điện thoại', 'Email']
    const rows = [
      ['Nguyễn Văn A', '0901234567', 'a@example.com'],
      ['Trần Thị B', '0912345678', 'b@example.com'],
    ]
    const csv = generateCsv(headers, rows)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Họ tên,Số điện thoại,Email')
    expect(csv).toContain('Nguyễn Văn A,0901234567,a@example.com')
  })

  it('generates Excel HTML with proper title, summary and escaped cells', () => {
    const title = 'Danh sách khách hàng'
    const headers = ['Tên', 'Chi tiêu']
    const rows = [['Nguyễn Văn & Cty', '1,000,000 VNĐ']]
    const summary = [{ label: 'Tổng khách', value: 1 }]

    const html = generateExcelHtml(title, headers, rows, summary)
    expect(html).toContain('Danh sách khách hàng')
    expect(html).toContain('Nguyễn Văn &amp; Cty')
    expect(html).toContain('Tổng khách')
    expect(html).toContain('<th>Tên</th>')
  })
})
