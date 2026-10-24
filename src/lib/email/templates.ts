/**
 * Shared email template system for Digistay.
 * Returns HTML + plain text for use with any transport (SMTP, Resend, etc.)
 *
 * Guest and account emails come in Vietnamese or English (`locale`, 'vi'
 * when left out); their texts are in messages/<locale>.json under `email`
 * (./i18n.ts). The ops alert stays Vietnamese: it goes to the Digistay team.
 *
 * In the HTML part, a message without tags is escaped as a whole (its
 * values with it); a message with tags (<b>…</b>) goes through t.markup with
 * its values escaped one by one, so its own text must hold no & < >.
 */
import {
  EMAIL_TIME_ZONE,
  emailTranslator,
  englishDate,
  englishDateTime,
  englishMoney,
  type EmailLocale,
} from './i18n'

export interface BaseEmailProps {
  recipientName?: string
  previewText?: string // Short text shown in inbox preview
  /** The reader's language; Vietnamese when left out. */
  locale?: EmailLocale
}

export const BRAND = {
  name: 'Digistay',
  tagline: 'Hotel OS — Hệ điều hành quản lý khách sạn',
  logoUrl: 'https://digistay.vn/logo.png',
  primary: '#a93119',
  primaryDark: '#8b1b05',
  primaryLight: '#cb492f',
  bg: '#fbf9f6',
  surface: '#ffffff',
  border: '#e4e2df',
  text: '#1b1c1a',
  textMuted: '#59413c',
  success: '#2a674c',
  error: '#ba1a1a',
  fontFamily: `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Values for t.markup in the HTML part: text escaped, numbers as they are. */
function escaped<T extends Record<string, string | number>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value])
  ) as T
}

/** The HTML for a message's <b>…</b> (or any other) tag. */
const strong = (style?: string) => (chunks: string) => `<strong${style ? ` style="${style}"` : ''}>${chunks}</strong>`

function formatVnd(amount: number, currency = 'VND', locale: EmailLocale = 'vi'): string {
  if (locale === 'en') return englishMoney(amount, currency)
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Vietnamese short weekdays, Sunday first, written out: Intl's 'vi-VN' weekday
// differs between ICU versions (local Node "Th 4", CI's Node something else).
const VI_WEEKDAYS = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7']

function formatDate(date: string | Date, locale: EmailLocale = 'vi'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (locale === 'en') return englishDate(d, { weekday: true })
  // "Th 4, 23/12/2026", Vietnam time (UTC+7, no daylight saving).
  const vn = new Date(d.getTime() + 7 * 3_600_000)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${VI_WEEKDAYS[vn.getUTCDay()]}, ${two(vn.getUTCDate())}/${two(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`
}

/** A moment (a password change, an invitation's expiry), Vietnam time. */
function formatDateTime(date: Date, locale: EmailLocale): string {
  return locale === 'en' ? englishDateTime(date) : date.toLocaleString('vi-VN', { timeZone: EMAIL_TIME_ZONE })
}

/**
 * Base layout wraps all email content with branded header/footer.
 */
function baseLayout(props: {
  previewText?: string
  bodyHtml: string
  locale?: EmailLocale
}): string {
  const { previewText, bodyHtml, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.layout')
  const brand = escapeHtml(t('brand'))
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  ${previewText ? `<meta name="x-apple-notification-preview" content="${escapeHtml(previewText)}" />` : ''}
  <title>${brand}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bg}; font-family: ${BRAND.fontFamily}; color: ${BRAND.text}; -webkit-font-smoothing: antialiased;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.bg};">${escapeHtml(previewText)}</div>` : ''}

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND.bg}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; background-color: ${BRAND.surface}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); padding: 32px 32px 28px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.18); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">🏨 ${brand}</span>
              </div>
              <div style="color: rgba(255,255,255,0.85); font-size: 13px; font-weight: 400;">
                ${escapeHtml(t('tagline'))}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 24px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND.bg}; padding: 24px 32px; border-top: 1px solid ${BRAND.border}; text-align: center;">
              <p style="margin: 0 0 8px; color: ${BRAND.textMuted}; font-size: 12px;">
                ${escapeHtml(t('automated'))}
              </p>
              <p style="margin: 0; color: ${BRAND.textMuted}; font-size: 12px;">
                ${escapeHtml(t('rights', { year: String(new Date().getFullYear()) }))}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ============================================
// 1. OTP Email
// ============================================
export interface OtpEmailTemplateProps extends BaseEmailProps {
  recipientEmail: string
  otp: string
  purpose: 'register' | 'forgot_password' | 'login' | 'change_email' | 'verify_account'
  expiresInMinutes?: number
}

export function otpEmailTemplate(props: OtpEmailTemplateProps): { html: string; text: string; subject: string } {
  const { otp, purpose, recipientName, expiresInMinutes = 5, previewText, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.otp')
  const common = emailTranslator(locale, 'email.common')
  const title = t(`titles.${purpose}`)
  const desc = t(`descriptions.${purpose}`)
  const greeting = recipientName
    ? common.markup('helloName', { ...escaped({ name: recipientName }), b: strong(`color: ${BRAND.text};`) })
    : escapeHtml(common('hello'))

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(title)}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>${escapeHtml(desc)}
    </p>

    <!-- OTP code -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, ${BRAND.bg} 0%, #f3eee9 100%); border: 1px dashed ${BRAND.primary}; border-radius: 16px; padding: 28px 24px;">
          <div style="font-size: 12px; font-weight: 600; color: ${BRAND.primary}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">
            ${escapeHtml(t('codeLabel'))}
          </div>
          <div style="font-size: 40px; font-weight: 800; color: ${BRAND.primary}; letter-spacing: 8px; font-family: 'Courier New', monospace; line-height: 1;">
            ${escapeHtml(otp)}
          </div>
          <div style="font-size: 13px; color: ${BRAND.textMuted}; margin-top: 12px;">
            ${t.markup('validFor', { minutes: expiresInMinutes, b: strong(`color: ${BRAND.text};`) })}
          </div>
        </td>
      </tr>
    </table>

    <!-- Warning -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0 0; background-color: #fff8e1; border-left: 3px solid #f59e0b; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; color: #78350f; line-height: 1.5;">
          ${t.markup('security', { b: strong() })}
        </td>
      </tr>
    </table>

    <p style="margin: 24px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      ${escapeHtml(t('ignore'))}
    </p>
  `

  const text =
    `${title}\n\n` +
    `${recipientName ? `${common('helloText', { name: recipientName })}\n` : ''}${desc}\n\n` +
    `${t('textCode', { otp })}\n` +
    `${t('textValid', { minutes: expiresInMinutes })}\n\n` +
    `${t('textIgnore')}\n\n` +
    `-- ${emailTranslator(locale, 'email.layout')('brand')}`

  return {
    html: baseLayout({ previewText: previewText || t('preview', { otp }), bodyHtml, locale }),
    text,
    subject: t('subject', { title }),
  }
}

// ============================================
// 2. Welcome / Account verified
// ============================================
export function welcomeEmailTemplate(props: BaseEmailProps & { loginUrl?: string }): { html: string; text: string; subject: string } {
  const { recipientName, loginUrl, previewText, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.welcome')
  const tags = { b: strong(), accent: strong(`color: ${BRAND.primary};`) }
  const welcome = recipientName
    ? t.markup('welcomeName', { ...escaped({ name: recipientName }), ...tags })
    : t.markup('welcome', tags)

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(t('title'))}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${welcome}<br/>
      ${escapeHtml(t('verified'))}
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${BRAND.bg}; border-radius: 12px; padding: 20px;">
          <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${escapeHtml(t('nextSteps'))}</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: ${BRAND.textMuted};">
            <li>${escapeHtml(t('steps.workspace'))}</li>
            <li>${escapeHtml(t('steps.members'))}</li>
            <li>${escapeHtml(t('steps.property'))}</li>
            <li>${escapeHtml(t('steps.bookings'))}</li>
          </ul>
        </td>
      </tr>
    </table>

    ${loginUrl ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(169, 49, 25, 0.25);">
            ${escapeHtml(t('signIn'))}
          </a>
        </td>
      </tr>
    </table>
    ` : ''}
  `

  return {
    html: baseLayout({ previewText: previewText || t('preview'), bodyHtml, locale }),
    text: `${t('text')}\n\n${loginUrl ? t('textSignIn', { url: loginUrl }) : ''}`,
    subject: t('subject'),
  }
}

// ============================================
// 3. Password changed notification
// ============================================
export function passwordChangedTemplate(props: BaseEmailProps & { changedAt?: Date; supportUrl?: string }): { html: string; text: string; subject: string } {
  const { recipientName, changedAt = new Date(), supportUrl, previewText, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.passwordChanged')
  const common = emailTranslator(locale, 'email.common')
  const greeting = recipientName
    ? common.markup('helloName', { ...escaped({ name: recipientName }), b: strong() })
    : escapeHtml(common('hello'))
  const time = formatDateTime(changedAt, locale)
  const notYou = supportUrl
    ? t.markup('notYouSupport', {
        link: (chunks) => `<a href="${escapeHtml(supportUrl)}" style="color: ${BRAND.primary}; font-weight: 600;">${chunks}</a>`,
      })
    : escapeHtml(t('notYou'))

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(t('title'))}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>
      ${t.markup('changed', { ...escaped({ time }), b: strong() })}
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="background-color: #f0fdf4; border-left: 3px solid ${BRAND.success}; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: #14532d; line-height: 1.5;">
            <strong>${escapeHtml(t('doneTitle'))}</strong><br/>
            ${escapeHtml(t('doneText'))}
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0 0; background-color: #fef2f2; border-left: 3px solid ${BRAND.error}; border-radius: 8px;">
      <tr>
        <td style="padding: 16px; font-size: 14px; color: #7f1d1d; line-height: 1.5;">
          <strong>${escapeHtml(t('notYouTitle'))}</strong><br/>
          ${notYou}
        </td>
      </tr>
    </table>
  `

  return {
    html: baseLayout({ previewText: previewText || t('preview'), bodyHtml, locale }),
    text: `${t('text', { time })}\n\n${t('textNotYou')}`,
    subject: t('subject'),
  }
}

// ============================================
// 4. Email change verification
// ============================================
export function emailChangeTemplate(props: BaseEmailProps & { newEmail: string; changeUrl: string; expiresInHours?: number }): { html: string; text: string; subject: string } {
  const { recipientName, newEmail, changeUrl, expiresInHours = 24, previewText, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.emailChange')
  const common = emailTranslator(locale, 'email.common')
  const greeting = recipientName
    ? common.markup('helloName', { ...escaped({ name: recipientName }), b: strong() })
    : escapeHtml(common('hello'))

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(t('title'))}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>
      ${t.markup('request', { ...escaped({ email: newEmail }), b: strong(), accent: strong(`color: ${BRAND.primary};`) })}
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, ${BRAND.bg} 0%, #f3eee9 100%); border-radius: 16px; padding: 28px 24px;">
          <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.textMuted};">
            ${escapeHtml(t('pressButton'))}
          </p>
          <a href="${escapeHtml(changeUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(169, 49, 25, 0.25);">
            ${escapeHtml(t('button'))}
          </a>
          <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND.textMuted};">
            ${t.markup('validFor', { hours: expiresInHours, b: strong() })}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5; word-break: break-all;">
      ${escapeHtml(common('copyLink'))} <a href="${escapeHtml(changeUrl)}" style="color: ${BRAND.primary};">${escapeHtml(changeUrl)}</a>
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0 0; background-color: #fff8e1; border-left: 3px solid #f59e0b; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; color: #78350f; line-height: 1.5;">
          ${escapeHtml(t('ignore'))}
        </td>
      </tr>
    </table>
  `

  return {
    html: baseLayout({ previewText: previewText || t('preview'), bodyHtml, locale }),
    text: [t('textRequest', { email: newEmail }), t('textConfirm', { url: changeUrl }), t('textValid', { hours: expiresInHours })].join('\n'),
    subject: t('subject'),
  }
}

// ============================================
// 5. Booking confirmation (improved)
// ============================================
export interface BookingConfirmationTemplateProps {
  guestName: string
  guestEmail: string
  bookingCode: string
  propertyName: string
  propertyAddress: string
  propertyPhone?: string | null
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  totalAmount: number
  currency?: string
  /** The hotel's public site. Guests have no booking page of their own: the
   * old "manage booking" link went to a page that does not exist. */
  propertyUrl: string
  notes?: string
  /** The hotel's check-in / check-out times (Policy); 14:00 / 12:00 when unset. */
  checkInTime?: string
  checkOutTime?: string
  /**
   * A request from the hotel's website: the hotel still has to confirm it.
   * The email must not tell the guest the room is booked.
   */
  awaitingConfirmation?: boolean
  /** The hotel's online deposit: its amount, the page to pay it (dat-coc), the deadline if any. */
  deposit?: { amount: number; url: string; deadline?: Date }
  /** The booking's language (Booking.locale); the links must already point to its pages. */
  locale?: EmailLocale
}

/** A deposit deadline: 16:45 20/12, or 20 Dec, 16:45 GMT+7. */
function formatDeadline(date: Date, locale: EmailLocale): string {
  if (locale === 'en') return englishDateTime(date, { year: false })
  return date.toLocaleString('vi-VN', {
    timeZone: EMAIL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

export function bookingConfirmationTemplate(props: BookingConfirmationTemplateProps): { html: string; text: string; subject: string } {
  const {
    guestName, bookingCode, propertyName, propertyAddress, propertyPhone,
    checkIn, checkOut, numAdults, numChildren, totalAmount, currency = 'VND', propertyUrl, notes,
    checkInTime = '14:00', checkOutTime = '12:00', awaitingConfirmation = false, deposit, locale = 'vi',
  } = props
  const t = emailTranslator(locale, 'email.booking')
  const common = emailTranslator(locale, 'email.common')
  const money = (amount: number) => formatVnd(amount, currency, locale)
  const deadline = deposit?.deadline ? formatDeadline(deposit.deadline, locale) : null

  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  )

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(t(awaitingConfirmation ? 'titleAwaiting' : 'titleConfirmed'))}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${common.markup('helloName', { ...escaped({ name: guestName }), b: strong(`color: ${BRAND.text};`) })},<br/>
      ${escapeHtml(awaitingConfirmation ? t('leadAwaiting', { hotel: propertyName }) : t('leadConfirmed'))}
    </p>

    <!-- Booking code banner -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); border-radius: 12px; padding: 16px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 4px;">
            ${escapeHtml(t('code'))}
          </div>
          <div style="font-size: 28px; color: #ffffff; font-weight: 800; letter-spacing: 2px; font-family: 'Courier New', monospace;">
            ${escapeHtml(bookingCode)}
          </div>
        </td>
      </tr>
    </table>

    <!-- Property details -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: ${BRAND.surface};">
          <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(propertyName)}</h2>
          <p style="margin: 0 0 4px; font-size: 13px; color: ${BRAND.textMuted};">📍 ${escapeHtml(propertyAddress)}</p>
          ${propertyPhone ? `<p style="margin: 0; font-size: 13px; color: ${BRAND.textMuted};">📞 ${escapeHtml(propertyPhone)}</p>` : ''}
        </td>
      </tr>
    </table>

    <!-- Stay details -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 20px; background-color: ${BRAND.bg};">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="50%" style="padding: 8px 0;">
                <div style="font-size: 11px; color: ${BRAND.textMuted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(t('checkIn'))}</div>
                <div style="font-size: 15px; color: ${BRAND.text}; font-weight: 600;">${escapeHtml(formatDate(checkIn, locale))}</div>
                <div style="font-size: 12px; color: ${BRAND.textMuted};">${escapeHtml(t('checkInFrom', { time: checkInTime }))}</div>
              </td>
              <td width="50%" style="padding: 8px 0;">
                <div style="font-size: 11px; color: ${BRAND.textMuted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(t('checkOut'))}</div>
                <div style="font-size: 15px; color: ${BRAND.text}; font-weight: 600;">${escapeHtml(formatDate(checkOut, locale))}</div>
                <div style="font-size: 12px; color: ${BRAND.textMuted};">${escapeHtml(t('checkOutBy', { time: checkOutTime }))}</div>
              </td>
            </tr>
          </table>
          <div style="border-top: 1px solid ${BRAND.border}; margin: 8px 0;"></div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: ${BRAND.textMuted};">
                👥 ${escapeHtml(t('adults', { count: numAdults }))}${numChildren > 0 ? `, ${escapeHtml(t('children', { count: numChildren }))}` : ''}
              </td>
              <td align="right" style="padding: 4px 0; font-size: 13px; color: ${BRAND.textMuted};">
                🌙 ${escapeHtml(t('nights', { count: nights }))}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${notes ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0;">
      <tr>
        <td style="background-color: ${BRAND.bg}; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: ${BRAND.text};">
          ${t.markup('note', { ...escaped({ note: notes }), b: strong() })}
        </td>
      </tr>
    </table>
    ` : ''}

    ${deposit ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid ${BRAND.border}; border-radius: 12px;">
      <tr>
        <td style="padding: 20px; text-align: center;">
          <div style="font-size: 15px; color: ${BRAND.text}; font-weight: 600; margin-bottom: 6px;">${escapeHtml(t('depositTitle', { amount: money(deposit.amount) }))}</div>
          <div style="font-size: 13px; color: ${BRAND.textMuted}; margin-bottom: 16px;">
            ${escapeHtml(t('depositHow', { hotel: propertyName }))}${deadline ? ` ${escapeHtml(t('depositDeadline', { deadline }))}` : ''} ${escapeHtml(t('depositIgnore'))}
          </div>
          <a href="${escapeHtml(deposit.url)}" style="display: inline-block; background: ${BRAND.text}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 600;">
            ${escapeHtml(t('depositButton'))}
          </a>
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- Total -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; background: linear-gradient(135deg, #f3eee9 0%, ${BRAND.bg} 100%); border-radius: 12px; padding: 20px;">
      <tr>
        <td>
          <div style="font-size: 12px; color: ${BRAND.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 4px;">
            ${escapeHtml(t(awaitingConfirmation ? 'totalAwaiting' : 'totalConfirmed'))}
          </div>
          <div style="font-size: 28px; color: ${BRAND.primary}; font-weight: 800;">
            ${escapeHtml(money(totalAmount))}
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(propertyUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(169, 49, 25, 0.25);">
            ${escapeHtml(t('hotelButton'))}
          </a>
        </td>
      </tr>
    </table>
  `

  const dates = `${formatDate(checkIn, locale)} - ${formatDate(checkOut, locale)}`
  const depositLine = deposit
    ? deadline
      ? t('textDepositBy', { amount: money(deposit.amount), deadline, url: deposit.url })
      : t('textDeposit', { amount: money(deposit.amount), url: deposit.url })
    : null
  return {
    html: baseLayout({ previewText: t('preview', { code: bookingCode, hotel: propertyName }), bodyHtml, locale }),
    text: (awaitingConfirmation
      ? [
          t('textAwaiting', { code: bookingCode }),
          t('textHotelAwaiting', { hotel: propertyName }),
          dates,
          t('textEstimate', { amount: money(totalAmount) }),
          ...(depositLine ? [depositLine] : []),
          t('textHotelPage', { url: propertyUrl }),
        ]
      : [
          t('textConfirmed', { code: bookingCode }),
          t('textHotel', { hotel: propertyName }),
          dates,
          t('textTotal', { amount: money(totalAmount) }),
          t('textHotelPage', { url: propertyUrl }),
        ]
    ).join('\n'),
    subject: t(awaitingConfirmation ? 'subjectAwaiting' : 'subjectConfirmed', { code: bookingCode, hotel: propertyName }),
  }
}

// ============================================
// 6. Workspace invitation (improved)
// ============================================
export interface WorkspaceInviteTemplateProps {
  recipientEmail: string
  recipientName?: string
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  expiresAt: Date
  personalMessage?: string
  previewText?: string
  /** The inviter's language (the page they sent it from). */
  locale?: EmailLocale
}

// Labels for the roles an invitation can give (WorkspaceRole in prisma/schema.prisma); any other is shown as it is.
const ROLE_LABELS = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'] as const
const hasRoleLabel = (role: string): role is (typeof ROLE_LABELS)[number] => (ROLE_LABELS as readonly string[]).includes(role)

export function workspaceInviteTemplate(props: WorkspaceInviteTemplateProps): { html: string; text: string; subject: string } {
  const { recipientName, inviterName, workspaceName, role, inviteUrl, expiresAt, personalMessage, previewText, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.invite')
  const common = emailTranslator(locale, 'email.common')
  const roleLabel = hasRoleLabel(role) ? t(`roles.${role}`) : role
  const greeting = recipientName
    ? common.markup('helloName', { ...escaped({ name: recipientName }), b: strong() })
    : escapeHtml(common('hello'))
  const expiryStr = formatDateTime(expiresAt, locale)

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(t('title'))}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>
      ${t.markup('invited', {
        ...escaped({ inviter: inviterName, workspace: workspaceName }),
        b: strong(`color: ${BRAND.text};`),
        accent: strong(`color: ${BRAND.primary};`),
      })}
    </p>

    ${personalMessage ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; background-color: ${BRAND.bg}; border-left: 3px solid ${BRAND.primary}; border-radius: 8px;">
      <tr>
        <td style="padding: 16px 20px; font-size: 14px; color: ${BRAND.text}; font-style: italic; line-height: 1.6;">
          "${escapeHtml(personalMessage)}"
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- Role badge -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background-color: ${BRAND.surface}; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 20px;">
          <div style="font-size: 12px; color: ${BRAND.textMuted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;">
            ${escapeHtml(t('roleLabel'))}
          </div>
          <div style="display: inline-block; background-color: ${BRAND.primary}; color: #ffffff; font-size: 14px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${escapeHtml(roleLabel)}
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(169, 49, 25, 0.25);">
            ${escapeHtml(t('accept'))}
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: ${BRAND.textMuted};">
            ${escapeHtml(t('expires', { time: expiryStr }))}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5; word-break: break-all;">
      ${escapeHtml(common('copyLink'))} <a href="${escapeHtml(inviteUrl)}" style="color: ${BRAND.primary};">${escapeHtml(inviteUrl)}</a>
    </p>
  `

  return {
    html: baseLayout({ previewText: previewText || t('preview', { inviter: inviterName, workspace: workspaceName }), bodyHtml, locale }),
    text: [
      t('text', { inviter: inviterName, workspace: workspaceName, role: roleLabel }),
      t('textAccept', { url: inviteUrl }),
      t('textExpires', { time: expiryStr }),
    ].join('\n'),
    subject: t('subject', { inviter: inviterName, workspace: workspaceName }),
  }
}

// ============================================
// 7. Invoice email (improved)
// ============================================
/** What an adjustment or replacement invoice's email says about the invoice it amends (delivery.ts). */
export function invoiceAmendsNote(
  locale: EmailLocale,
  amends: { kind: 'adjustsDown' | 'adjustsUp' | 'replaces'; einvoiceNumber: string | null }
): string {
  // String(): a missing number reads as it always has ("null"); an amended invoice is a published one.
  return emailTranslator(locale, 'email.invoice')(amends.kind, { number: String(amends.einvoiceNumber) })
}

export function invoiceEmailTemplate(props: {
  customerName: string
  einvoiceNumber: string
  series: string
  lookupCode: string
  bookingCode: string
  propertyName: string
  totalAmount: number
  taxAmount: number
  note?: string
  currency?: string
  /** The booking's language (Booking.locale). */
  locale?: EmailLocale
}): { html: string; text: string; subject: string } {
  const { customerName, einvoiceNumber, series, lookupCode, bookingCode, propertyName, totalAmount, taxAmount, note, currency = 'VND', locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.invoice')
  const common = emailTranslator(locale, 'email.common')
  const money = (amount: number) => formatVnd(amount, currency, locale)
  const numberValue = t('numberValue', { number: einvoiceNumber, series })
  const row = (label: string, value: string) => `
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">${escapeHtml(label)}</td>
              <td align="right" style="padding: 6px 0; font-size: 14px; color: ${BRAND.text}; font-weight: 600;">${escapeHtml(value)}</td>
            </tr>`

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">${escapeHtml(t('title'))}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${common.markup('helloName', { ...escaped({ name: customerName }), b: strong(`color: ${BRAND.text};`) })},<br/>
      ${escapeHtml(t('issued', { hotel: propertyName }))}
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: ${BRAND.surface};">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${row(t('number'), numberValue)}
            ${row(t('lookupCode'), lookupCode)}
            ${row(t('bookingCode'), bookingCode)}
            ${row(t('hotel'), propertyName)}
            ${note ? row(t('note'), note) : ''}
            <tr><td colspan="2" style="padding: 8px 0;"><div style="border-top: 1px solid ${BRAND.border};"></div></td></tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">${escapeHtml(t('tax'))}</td>
              <td align="right" style="padding: 6px 0; font-size: 14px; color: ${BRAND.text};">${escapeHtml(money(taxAmount))}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: ${BRAND.text}; font-weight: 700;">${escapeHtml(t('total'))}</td>
              <td align="right" style="padding: 6px 0; font-size: 20px; color: ${BRAND.primary}; font-weight: 800;">${escapeHtml(money(totalAmount))}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${escapeHtml(t('lookup'))}
    </p>
  `

  return {
    html: baseLayout({ previewText: t('preview', { number: einvoiceNumber, amount: money(totalAmount) }), bodyHtml, locale }),
    text: [
      common('helloText', { name: customerName }),
      t('textIssued', { hotel: propertyName }),
      `${t('number')}: ${numberValue}`,
      `${t('lookupCode')}: ${lookupCode}`,
      `${t('bookingCode')}: ${bookingCode}`,
      ...(note ? [`${t('note')}: ${note}`] : []),
      `${t('tax')}: ${money(taxAmount)}`,
      `${t('total')}: ${money(totalAmount)}`,
    ].join('\n'),
    subject: t('subject', { number: einvoiceNumber, hotel: propertyName }),
  }
}

// ============================================
// 8. Guest deposits (outbox.ts): received, or the booking cancelled at its deadline
// ============================================
export interface DepositReceivedTemplateProps {
  guestName: string
  bookingCode: string
  propertyName: string
  propertyPhone?: string | null
  checkIn: Date
  checkOut: Date
  deposit: number
  /** still to pay at the hotel */
  remaining: number
  /** The booking's language (Booking.locale). */
  locale?: EmailLocale
}

// Plain text; the HTML part is that text, escaped (the guest's name comes from a public form).
const textAsHtml = (text: string) => escapeHtml(text).replace(/\n/g, '<br/>')

export function depositReceivedTemplate(props: DepositReceivedTemplateProps): { html: string; text: string; subject: string } {
  const { guestName, bookingCode, propertyName, propertyPhone, checkIn, checkOut, deposit, remaining, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.depositReceived')
  const common = emailTranslator(locale, 'email.common')
  const day = (d: Date) => (locale === 'en' ? englishDate(d) : d.toLocaleDateString('vi-VN', { timeZone: EMAIL_TIME_ZONE }))
  const vnd = (n: number) => (locale === 'en' ? englishMoney(n) : `${Math.round(n).toLocaleString('vi-VN')} ₫`)
  const text = [
    common('helloText', { name: guestName }),
    '',
    t('received', { hotel: propertyName, amount: vnd(deposit), code: bookingCode }),
    t('dates', { checkIn: day(checkIn), checkOut: day(checkOut) }),
    ...(remaining > 0 ? [t('remaining', { amount: vnd(remaining) })] : []),
    ...(propertyPhone ? [common('contactHotel', { phone: propertyPhone })] : []),
  ].join('\n')
  return { subject: t('subject', { code: bookingCode }), text, html: textAsHtml(text) }
}

export interface DepositExpiredTemplateProps {
  guestName: string
  bookingCode: string
  propertyName: string
  propertyPhone?: string | null
  /** The booking's language (Booking.locale). */
  locale?: EmailLocale
}

export function depositExpiredTemplate(props: DepositExpiredTemplateProps): { html: string; text: string; subject: string } {
  const { guestName, bookingCode, propertyName, propertyPhone, locale = 'vi' } = props
  const t = emailTranslator(locale, 'email.depositExpired')
  const common = emailTranslator(locale, 'email.common')
  const text = [
    common('helloText', { name: guestName }),
    '',
    t('cancelled', { hotel: propertyName, code: bookingCode }),
    t('alreadyPaid'),
    ...(propertyPhone ? [common('contactHotel', { phone: propertyPhone })] : []),
  ].join('\n')
  return { subject: t('subject', { code: bookingCode }), text, html: textAsHtml(text) }
}

// ============================================
//  Ops alerts (src/lib/ops/alerts.ts), for the people running Digistay
// ============================================
export function opsAlertTemplate(
  findings: { severity: 'critical' | 'warning'; title: string; lines: string[] }[]
): { html: string; text: string; subject: string } {
  const critical = findings.filter((f) => f.severity === 'critical').length
  const label = (s: string) => (s === 'critical' ? 'NGHIÊM TRỌNG' : 'Cảnh báo')
  const bodyHtml = `
    <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: ${BRAND.text};">Cảnh báo vận hành Digistay</h1>
    ${findings
      .map(
        (f) => `
    <div style="margin: 0 0 16px; padding: 12px 14px; border: 1px solid ${BRAND.border}; border-radius: 8px;">
      <p style="margin: 0 0 6px; font-size: 14px; font-weight: 700; color: ${f.severity === 'critical' ? '#b42318' : BRAND.text};">
        ${label(f.severity)}: ${escapeHtml(f.title)}
      </p>
      ${f.lines.map((l) => `<p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${BRAND.textMuted};">${escapeHtml(l)}</p>`).join('')}
    </div>`
      )
      .join('')}
    <p style="margin: 0; font-size: 12px; color: ${BRAND.textMuted};">Email này nhắc lại mỗi 6 giờ (nghiêm trọng) hoặc 24 giờ (cảnh báo) cho tới khi vấn đề hết. Xử lý: docs/RUNBOOK.md.</p>
  `
  return {
    html: baseLayout({ previewText: findings[0]?.title ?? 'Cảnh báo vận hành', bodyHtml }),
    text: findings.map((f) => [`${label(f.severity)}: ${f.title}`, ...f.lines.map((l) => `  - ${l}`)].join('\n')).join('\n\n'),
    subject: `[Digistay] ${critical > 0 ? `${critical} nghiêm trọng, ` : ''}${findings.length} cảnh báo: ${findings[0]?.title ?? ''}`.slice(0, 200),
  }
}
