/**
 * Guest and account emails in both languages: Vietnamese as it always was,
 * English with English dates (23 Dec 2026), money (1,700,000 ₫), plurals and
 * links to the English pages; values escaped in the HTML part either way.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import vi_ from '../../../messages/vi.json'
import en_ from '../../../messages/en.json'
import {
  bookingConfirmationTemplate,
  depositExpiredTemplate,
  depositReceivedTemplate,
  emailChangeTemplate,
  invoiceAmendsNote,
  invoiceEmailTemplate,
  opsAlertTemplate,
  otpEmailTemplate,
  passwordChangedTemplate,
  welcomeEmailTemplate,
  workspaceInviteTemplate,
  type BookingConfirmationTemplateProps,
} from './templates'
import { emailLocale } from './i18n'
import { appSiteUrl } from '@/lib/public-site/paths'
import { depositUrl } from '@/lib/payments/deposit-link'

// A translation that fails logs through console.error and prints its key
// ("email.booking.x"): neither may happen.
let errors: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errors = vi.spyOn(console, 'error')
})
afterEach(() => {
  expect(errors).not.toHaveBeenCalled()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})
const noKeys = (mail: { subject: string; text: string; html: string }) => {
  for (const part of [mail.subject, mail.text, mail.html]) expect(part).not.toMatch(/email\.\w+\./)
  return mail
}

const NAME = 'Hoa <b>&</b>'
const booking: BookingConfirmationTemplateProps = {
  guestName: NAME,
  guestEmail: 'hoa@example.com',
  bookingCode: 'DSABC123',
  propertyName: 'Sen Hotel',
  propertyAddress: '1 Lê Lợi, Huế',
  propertyPhone: '0234 123 456',
  // Midnight UTC is 07:00 in Vietnam: the same day there.
  checkIn: '2026-12-23T00:00:00.000Z',
  checkOut: '2026-12-25T00:00:00.000Z',
  numAdults: 2,
  numChildren: 1,
  totalAmount: 1_700_000,
  propertyUrl: 'https://digistay.test/sen',
  checkInTime: '15:00',
  checkOutTime: '11:00',
}
const deposit = { amount: 510_000, url: 'https://digistay.test/sen/en/dat-coc/tok.sig', deadline: new Date('2026-12-20T09:45:00Z') }

describe('booking confirmation', () => {
  it('Vietnamese, as it always was', () => {
    const mail = noKeys(bookingConfirmationTemplate({ ...booking, awaitingConfirmation: true, deposit: { ...deposit, url: 'https://digistay.test/sen/dat-coc/tok.sig' } }))
    expect(mail.subject).toBe('[DSABC123] Đã nhận yêu cầu đặt phòng tại Sen Hotel')
    expect(mail.html).toContain('<html lang="vi">')
    expect(mail.html).toContain('Th 4, 23/12/2026')
    expect(mail.html).toContain('từ 15:00')
    expect(mail.html).toContain('2 người lớn, 1 trẻ em')
    expect(mail.html).toContain('🌙 2 đêm')
    expect(mail.html).toContain('Hạn đặt cọc: 16:45 20-12; quá hạn, đặt phòng tự huỷ.')
    expect(mail.html).toContain('Mọi quyền được bảo lưu.')
    expect(mail.text).toBe(
      [
        'Đã nhận yêu cầu đặt phòng DSABC123',
        'Khách sạn: Sen Hotel (sẽ liên hệ để xác nhận)',
        'Th 4, 23/12/2026 - Th 6, 25/12/2026',
        // Intl puts a no-break space before ₫.
        'Tạm tính: 1.700.000\u00a0₫',
        'Đặt cọc 510.000\u00a0₫ trước 16:45 20-12: https://digistay.test/sen/dat-coc/tok.sig',
        'Trang khách sạn: https://digistay.test/sen',
      ].join('\n')
    )
  })

  it('English: request received, English dates, money and plurals', () => {
    const mail = noKeys(bookingConfirmationTemplate({ ...booking, propertyUrl: 'https://digistay.test/sen/en', awaitingConfirmation: true, deposit, locale: 'en' }))
    expect(mail.subject).toBe('[DSABC123] Booking request received at Sen Hotel')
    expect(mail.html).toContain('<html lang="en">')
    expect(mail.html).toContain('Booking request received')
    expect(mail.html).toContain('Wed, 23 Dec 2026')
    expect(mail.html).toContain('from 15:00')
    expect(mail.html).toContain('by 11:00')
    expect(mail.html).toContain('2 adults, 1 child')
    expect(mail.html).toContain('🌙 2 nights')
    expect(mail.html).toContain('Pay a 510,000 ₫ deposit to confirm your booking')
    expect(mail.html).toContain('Deadline: 20 Dec, 16:45 GMT+7')
    expect(mail.html).toContain('Estimated total')
    expect(mail.html).toContain('href="https://digistay.test/sen/en/dat-coc/tok.sig"')
    expect(mail.html).toContain('href="https://digistay.test/sen/en"')
    expect(mail.html).toContain('All rights reserved.')
    expect(mail.html).not.toMatch(/Đặt|phòng|Xin chào/)
    expect(mail.text).toBe(
      [
        'Booking request DSABC123 received',
        'Hotel: Sen Hotel (will contact you to confirm)',
        'Wed, 23 Dec 2026 - Fri, 25 Dec 2026',
        'Estimated total: 1,700,000 ₫',
        'Pay the 510,000 ₫ deposit by 20 Dec, 16:45 GMT+7: https://digistay.test/sen/en/dat-coc/tok.sig',
        'Hotel website: https://digistay.test/sen/en',
      ].join('\n')
    )
  })

  it('English: confirmed by staff, one of each', () => {
    const mail = noKeys(
      bookingConfirmationTemplate({ ...booking, numAdults: 1, numChildren: 0, checkOut: '2026-12-24T00:00:00.000Z', notes: 'Late <arrival>', locale: 'en' })
    )
    expect(mail.subject).toBe('[DSABC123] ✅ Your booking at Sen Hotel is confirmed')
    expect(mail.html).toContain('✅ Booking confirmed')
    expect(mail.html).toContain('👥 1 adult\n')
    expect(mail.html).toContain('🌙 1 night\n')
    expect(mail.html).toContain('<strong>📝 Note:</strong> Late &lt;arrival&gt;')
    expect(mail.text).toContain('Total: 1,700,000 ₫')
  })

  it("escapes the guest's name in the HTML part, in both languages", () => {
    for (const locale of ['vi', 'en'] as const) {
      const mail = bookingConfirmationTemplate({ ...booking, propertyName: 'Sen <i>Hotel</i>', awaitingConfirmation: true, locale })
      expect(mail.html).toContain('Hoa &lt;b&gt;&amp;&lt;/b&gt;')
      expect(mail.html).not.toContain('<b>&</b>')
      expect(mail.html).not.toContain('<i>Hotel</i>')
      expect(mail.html).toContain('Sen &lt;i&gt;Hotel&lt;/i&gt;')
    }
  })
})

describe('links in English emails go to the English pages', () => {
  it("on the app's host: /<hotel>/en/...", () => {
    expect(appSiteUrl('https://digistay.vn', 'sen', 'vi')).toBe('https://digistay.vn/sen')
    expect(appSiteUrl('https://digistay.vn', 'sen', 'en')).toBe('https://digistay.vn/sen/en')
    vi.stubEnv('NEXTAUTH_URL', 'https://digistay.vn')
    vi.stubEnv('NEXTAUTH_SECRET', 'templates-test-secret')
    expect(depositUrl('sen', 'b1')).toMatch(/^https:\/\/digistay\.vn\/sen\/dat-coc\/b1\./)
    expect(depositUrl('sen', 'b1', 'en')).toMatch(/^https:\/\/digistay\.vn\/sen\/en\/dat-coc\/b1\./)
  })
})

describe('deposit emails', () => {
  const data = {
    guestName: NAME,
    bookingCode: 'DSABC123',
    propertyName: 'Sen Hotel',
    propertyPhone: '0234 123 456',
    checkIn: new Date('2026-12-23T00:00:00Z'),
    checkOut: new Date('2026-12-25T00:00:00Z'),
    deposit: 510_000,
    remaining: 1_190_000,
  }

  it('received, in both languages', () => {
    const viMail = noKeys(depositReceivedTemplate(data))
    expect(viMail.subject).toBe('Đã nhận tiền cọc - đặt phòng #DSABC123 đã được xác nhận')
    expect(viMail.text).toContain('Sen Hotel đã nhận 510.000 ₫ tiền cọc cho đặt phòng DSABC123.')
    expect(viMail.text).toContain('Nhận phòng: 23/12/2026 · Trả phòng: 25/12/2026')

    const mail = noKeys(depositReceivedTemplate({ ...data, locale: 'en' }))
    expect(mail.subject).toBe('Deposit received - booking #DSABC123 is confirmed')
    expect(mail.text).toBe(
      [
        `Hello ${NAME},`,
        '',
        'Sen Hotel has received your 510,000 ₫ deposit for booking DSABC123. Your booking is confirmed.',
        'Check-in: 23 Dec 2026 · Check-out: 25 Dec 2026',
        'To pay at check-in: 1,190,000 ₫',
        'Hotel phone: 0234 123 456',
      ].join('\n')
    )
    expect(mail.html).toContain('Hello Hoa &lt;b&gt;&amp;&lt;/b&gt;,<br/>')
  })

  it('expired, in both languages', () => {
    expect(depositExpiredTemplate(data).subject).toBe('Đặt phòng #DSABC123 đã được huỷ vì chưa nhận được tiền cọc')
    const mail = noKeys(depositExpiredTemplate({ ...data, propertyPhone: null, locale: 'en' }))
    expect(mail.subject).toBe("Booking #DSABC123 was cancelled: the deposit didn't arrive")
    expect(mail.text).toContain("Sen Hotel didn't receive the deposit for booking DSABC123 in time")
    expect(mail.text).not.toContain('Hotel phone')
    expect(mail.html).not.toContain('<b>')
  })
})

describe('invoice email', () => {
  const invoice = {
    customerName: 'Công ty TNHH Sen',
    einvoiceNumber: '12',
    series: 'C26TAA',
    lookupCode: 'DSINV1',
    bookingCode: 'DSABC123',
    propertyName: 'Sen Hotel',
    totalAmount: 1_080_000,
    taxAmount: 80_000,
  }

  it('in Vietnamese and in English, with the note on what it amends', () => {
    const viMail = noKeys(invoiceEmailTemplate({ ...invoice, note: invoiceAmendsNote('vi', { kind: 'adjustsDown', einvoiceNumber: '7' }) }))
    expect(viMail.subject).toBe('Hóa đơn điện tử số 12 - Sen Hotel')
    expect(viMail.text).toContain('Ghi chú: Điều chỉnh giảm cho hoá đơn số 7')
    expect(viMail.text).toContain('Tổng cộng: 1.080.000\u00a0₫')

    const mail = noKeys(invoiceEmailTemplate({ ...invoice, note: invoiceAmendsNote('en', { kind: 'replaces', einvoiceNumber: '7' }), locale: 'en' }))
    expect(mail.subject).toBe('E-invoice no. 12 - Sen Hotel')
    expect(mail.html).toContain('🧾 Your e-invoice')
    expect(mail.html).toContain('12 (series C26TAA)')
    expect(mail.text).toContain('Lookup code: DSINV1')
    expect(mail.text).toContain('Note: Replaces invoice no. 7')
    expect(mail.text).toContain('VAT: 80,000 ₫')
    expect(mail.text).toContain('Total: 1,080,000 ₫')
    expect(invoiceAmendsNote('en', { kind: 'adjustsUp', einvoiceNumber: '9' })).toBe('Adjustment (increase) to invoice no. 9')
  })
})

describe('account emails', () => {
  it('sign-in code', () => {
    const viMail = noKeys(otpEmailTemplate({ recipientEmail: 'a@x.vn', otp: '482913', purpose: 'register' }))
    expect(viMail.subject).toBe('[Digistay] Xác thực tài khoản - Mã xác thực OTP')
    expect(viMail.text).toContain('Có hiệu lực trong 5 phút.')

    const mail = noKeys(otpEmailTemplate({ recipientEmail: 'a@x.vn', otp: '482913', purpose: 'forgot_password', recipientName: NAME, locale: 'en' }))
    expect(mail.subject).toBe('[Digistay] Reset your password - your verification code')
    expect(mail.html).toContain('<html lang="en">')
    expect(mail.html).toContain('Valid for <strong style="color: #1b1c1a;">5 minutes</strong>')
    expect(mail.html).toContain('Hello <strong style="color: #1b1c1a;">Hoa &lt;b&gt;&amp;&lt;/b&gt;</strong>,<br/>')
    expect(mail.text).toBe(
      [
        'Reset your password',
        '',
        `Hello ${NAME},`,
        'We received a request to reset your password. Enter the code below to continue.',
        '',
        'Your code: 482913',
        'Valid for 5 minutes.',
        '',
        "If you didn't ask for this code, please ignore this email.",
        '',
        '-- Digistay',
      ].join('\n')
    )
    expect(otpEmailTemplate({ recipientEmail: 'a@x.vn', otp: '1', purpose: 'login', expiresInMinutes: 1, locale: 'en' }).text).toContain('Valid for 1 minute.')
  })

  it('welcome, password changed, email change', () => {
    const welcome = noKeys(welcomeEmailTemplate({ recipientName: NAME, loginUrl: 'https://digistay.test/login', locale: 'en' }))
    expect(welcome.subject).toBe('Welcome to Digistay! 🎉')
    expect(welcome.html).toContain('Welcome to <strong style="color: #a93119;">Digistay</strong>, <strong>Hoa &lt;b&gt;&amp;&lt;/b&gt;</strong>.')
    expect(welcome.html).toContain('<li>Start managing bookings &amp; guests</li>')
    expect(welcome.text).toBe('Welcome to Digistay! Your account is verified.\n\nSign in: https://digistay.test/login')
    expect(welcomeEmailTemplate({}).subject).toBe('Chào mừng bạn đến với Digistay! 🎉')

    const changedAt = new Date('2026-12-23T08:30:05Z')
    const password = noKeys(passwordChangedTemplate({ changedAt, supportUrl: 'https://digistay.test/lien-he', locale: 'en' }))
    expect(password.subject).toBe('[Digistay] Your password was changed')
    expect(password.html).toContain('was changed on <strong>23 Dec 2026, 15:30 GMT+7</strong>.')
    expect(password.html).toContain('through our <a href="https://digistay.test/lien-he" style="color: #a93119; font-weight: 600;">support page</a>')
    expect(password.text).toBe("Your Digistay password was changed on 23 Dec 2026, 15:30 GMT+7.\n\nIf this wasn't you, contact support right away.")
    expect(passwordChangedTemplate({ changedAt }).text).toContain('15:30:05 23/12/2026')

    const change = noKeys(emailChangeTemplate({ newEmail: 'new@x.vn', changeUrl: 'https://digistay.test/c?t=1&x=2', expiresInHours: 24, locale: 'en' }))
    expect(change.subject).toBe('[Digistay] Confirm your new email address')
    expect(change.html).toContain('valid for <strong>24 hours</strong>')
    expect(change.html).toContain('href="https://digistay.test/c?t=1&amp;x=2"')
    expect(change.text).toBe('Request to change your email to new@x.vn.\nConfirm: https://digistay.test/c?t=1&x=2\nThe link is valid for 24 hours.')
  })

  it("workspace invitation, in the inviter's language", () => {
    const invite = {
      recipientEmail: 'nv@x.vn',
      inviterName: 'An <Sen>',
      workspaceName: 'Sen & Co',
      role: 'ADMIN',
      inviteUrl: 'https://digistay.test/invitations/tok',
      expiresAt: new Date('2026-12-30T10:00:00Z'),
    }
    expect(workspaceInviteTemplate(invite).subject).toBe('An <Sen> mời bạn vào Sen & Co')
    const mail = noKeys(workspaceInviteTemplate({ ...invite, locale: 'en' }))
    expect(mail.subject).toBe('An <Sen> invited you to Sen & Co on Digistay')
    expect(mail.html).toContain('<strong style="color: #1b1c1a;">An &lt;Sen&gt;</strong> has invited you to join the <strong style="color: #a93119;">Sen &amp; Co</strong> workspace')
    expect(mail.html).toContain('Admin')
    expect(mail.text).toBe(
      'An <Sen> invited you to join Sen & Co as Admin.\nAccept: https://digistay.test/invitations/tok\nExpires: 30 Dec 2026, 17:00 GMT+7'
    )
  })

  it('the ops alert stays Vietnamese', () => {
    const mail = opsAlertTemplate([{ severity: 'critical', title: 'DB', lines: [] }])
    expect(mail.html).toContain('<html lang="vi">')
    expect(mail.html).toContain('Mọi quyền được bảo lưu.')
  })
})

describe('the email messages', () => {
  type Tree = { [key: string]: string | Tree }
  const flatten = (tree: Tree, prefix = ''): [string, string][] =>
    Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : flatten(value, `${prefix}${key}.`)))
  const tags = (message: string) => [...message.matchAll(/<\/?(\w+)>/g)].map((m) => m[0]).sort()

  it('have the same tags in both languages, and no & < > of their own beside them', () => {
    const en = Object.fromEntries(flatten(en_.email as Tree))
    for (const [key, message] of flatten(vi_.email as Tree)) {
      expect(tags(en[key]), key).toEqual(tags(message))
      // Tagged messages go into the HTML unescaped (t.markup): only the tags may be markup.
      for (const text of [message, en[key]]) {
        if (tags(text).length) expect(text.replace(/<\/?\w+>/g, ''), key).not.toMatch(/[&<>]/)
      }
    }
  })

  it("a booking's stored language: 'vi' | 'en', anything else Vietnamese", () => {
    expect(emailLocale('en')).toBe('en')
    expect(emailLocale('vi')).toBe('vi')
    expect(emailLocale('fr')).toBe('vi')
    expect(emailLocale(undefined)).toBe('vi')
  })
})
