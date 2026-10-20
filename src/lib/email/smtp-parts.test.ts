/**
 * What reaches SMTP: the HTML part is the template and the text part plain
 * text (they used to be swapped for every email), and invoice emails carry
 * the PDF.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMail = vi.hoisted(() => vi.fn(async () => ({ messageId: 'm1' })))
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }))

import { sendInvoiceEmail, sendOtpEmail } from './index'

beforeEach(() => {
  vi.stubEnv('EMAIL_SERVER_HOST', 'smtp.example.com')
  vi.stubEnv('EMAIL_SERVER_PORT', '587')
  vi.stubEnv('EMAIL_SERVER_USER', 'user')
  vi.stubEnv('EMAIL_SERVER_PASSWORD', 'pass')
  sendMail.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

const lastMail = () => (sendMail.mock.calls.at(-1) as unknown as [Record<string, any>])[0]

describe('SMTP message parts', () => {
  it('sends the HTML template as html and plain text as text', async () => {
    const result = await sendOtpEmail({ recipientEmail: 'a@example.com', otp: '482913', purpose: 'forgot_password' })
    expect(result).toMatchObject({ success: true, sent: true })
    const mail = lastMail()
    expect(mail.html).toMatch(/<table/i)
    expect(mail.text).not.toMatch(/<table|<div|<p/i)
    expect(mail.text).toContain('482913')
    expect(mail.attachments).toBeUndefined()
  })

  it('attaches the invoice PDF', async () => {
    const pdf = Buffer.from('%PDF-1.4 test')
    await sendInvoiceEmail({
      to: 'ketoan@sen.vn',
      customerName: 'Công ty TNHH Du Lịch Sen',
      einvoiceNumber: '12',
      series: 'C26TAA',
      lookupCode: 'DSINV261021ABCD',
      bookingCode: 'DS123',
      propertyName: 'Khách sạn Sen',
      totalAmount: 1_080_000,
      taxAmount: 80_000,
      note: 'Điều chỉnh giảm cho hoá đơn số 7',
      pdf: { filename: 'hoa-don-12.pdf', content: pdf },
    })
    const mail = lastMail()
    expect(mail.to).toContain('ketoan@sen.vn')
    expect(mail.subject).toBe('Hóa đơn điện tử số 12 - Khách sạn Sen')
    expect(mail.attachments).toEqual([{ filename: 'hoa-don-12.pdf', content: pdf, contentType: 'application/pdf' }])
    expect(mail.html).toContain('DSINV261021ABCD')
    expect(mail.html).toContain('Điều chỉnh giảm cho hoá đơn số 7')
    expect(mail.text).toContain('Mã tra cứu: DSINV261021ABCD')
  })
})
