/**
 * Shared email template system for DigiStay.
 * Returns HTML + plain text for use with any transport (SMTP, Resend, etc.)
 */

export interface BaseEmailProps {
  recipientName?: string
  previewText?: string // Short text shown in inbox preview
}

export const BRAND = {
  name: 'DigiStay',
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

function formatVnd(amount: number, currency = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Base layout wraps all email content with branded header/footer.
 */
function baseLayout(props: {
  previewText?: string
  bodyHtml: string
}): string {
  const { previewText, bodyHtml } = props
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  ${previewText ? `<meta name="x-apple-notification-preview" content="${escapeHtml(previewText)}" />` : ''}
  <title>${BRAND.name}</title>
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
                <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">🏨 ${BRAND.name}</span>
              </div>
              <div style="color: rgba(255,255,255,0.85); font-size: 13px; font-weight: 400;">
                ${BRAND.tagline}
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
                Email này được gửi tự động từ ${BRAND.name}. Vui lòng không trả lời trực tiếp.
              </p>
              <p style="margin: 0; color: ${BRAND.textMuted}; font-size: 12px;">
                © ${new Date().getFullYear()} ${BRAND.name}. Mọi quyền được bảo lưu.
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

const OTP_PURPOSE_TITLE: Record<OtpEmailTemplateProps['purpose'], string> = {
  register: 'Xác thực tài khoản',
  forgot_password: 'Đặt lại mật khẩu',
  login: 'Đăng nhập bằng mã OTP',
  change_email: 'Xác nhận thay đổi email',
  verify_account: 'Xác thực tài khoản',
}

const OTP_PURPOSE_DESC: Record<OtpEmailTemplateProps['purpose'], string> = {
  register: 'Cảm ơn bạn đã đăng ký tài khoản DigiStay. Vui lòng nhập mã bên dưới để hoàn tất đăng ký.',
  forgot_password: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu. Vui lòng nhập mã bên dưới để tiếp tục.',
  login: 'Đăng nhập nhanh không cần mật khẩu bằng mã OTP dưới đây.',
  change_email: 'Bạn vừa yêu cầu thay đổi địa chỉ email. Nhập mã dưới đây để xác nhận.',
  verify_account: 'Vui lòng xác thực tài khoản của bạn bằng mã OTP dưới đây.',
}

export function otpEmailTemplate(props: OtpEmailTemplateProps): { html: string; text: string; subject: string } {
  const { otp, purpose, recipientName, expiresInMinutes = 5, previewText } = props
  const title = OTP_PURPOSE_TITLE[purpose]
  const desc = OTP_PURPOSE_DESC[purpose]
  const greeting = recipientName ? `Xin chào <strong style="color: ${BRAND.text};">${escapeHtml(recipientName)}</strong>` : 'Xin chào'

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">${title}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>${desc}
    </p>

    <!-- OTP code -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, ${BRAND.bg} 0%, #f3eee9 100%); border: 1px dashed ${BRAND.primary}; border-radius: 16px; padding: 28px 24px;">
          <div style="font-size: 12px; font-weight: 600; color: ${BRAND.primary}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">
            Mã xác thực của bạn
          </div>
          <div style="font-size: 40px; font-weight: 800; color: ${BRAND.primary}; letter-spacing: 8px; font-family: 'Courier New', monospace; line-height: 1;">
            ${otp}
          </div>
          <div style="font-size: 13px; color: ${BRAND.textMuted}; margin-top: 12px;">
            ⏱️ Có hiệu lực trong <strong style="color: ${BRAND.text};">${expiresInMinutes} phút</strong>
          </div>
        </td>
      </tr>
    </table>

    <!-- Warning -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0 0; background-color: #fff8e1; border-left: 3px solid #f59e0b; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; color: #78350f; line-height: 1.5;">
          <strong>🛡️ Bảo mật:</strong> Không chia sẻ mã này với bất kỳ ai. DigiStay sẽ không bao giờ hỏi mã OTP qua điện thoại.
        </td>
      </tr>
    </table>

    <p style="margin: 24px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email — tài khoản của bạn vẫn an toàn.
    </p>
  `

  const text =
    `${title}\n\n` +
    `${recipientName ? `Xin chào ${recipientName},\n` : ''}${desc}\n\n` +
    `Mã OTP: ${otp}\n` +
    `Có hiệu lực trong ${expiresInMinutes} phút.\n\n` +
    `Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.\n\n` +
    `-- ${BRAND.name}`

  return {
    html: baseLayout({ previewText: previewText || `Mã OTP: ${otp}`, bodyHtml }),
    text,
    subject: `[${BRAND.name}] ${title} - Mã xác thực OTP`,
  }
}

// ============================================
// 2. Welcome / Account verified
// ============================================
export function welcomeEmailTemplate(props: BaseEmailProps & { loginUrl?: string }): { html: string; text: string; subject: string } {
  const { recipientName, loginUrl, previewText } = props
  const greeting = recipientName ? `Chào mừng <strong>${escapeHtml(recipientName)}</strong>` : 'Chào mừng bạn'

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">🎉 Tài khoản đã sẵn sàng!</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting} đến với <strong style="color: ${BRAND.primary};">${BRAND.name}</strong>.<br/>
      Email của bạn đã được xác thực thành công. Bạn có thể bắt đầu sử dụng ngay bây giờ.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${BRAND.bg}; border-radius: 12px; padding: 20px;">
          <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: ${BRAND.text};">Bước tiếp theo:</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: ${BRAND.textMuted};">
            <li>Tạo workspace đầu tiên của bạn</li>
            <li>Thêm thành viên và phân quyền</li>
            <li>Cấu hình thuộc tính khách sạn</li>
            <li>Bắt đầu quản lý bookings &amp; khách hàng</li>
          </ul>
        </td>
      </tr>
    </table>

    ${loginUrl ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(169, 49, 25, 0.25);">
            Đăng nhập ngay →
          </a>
        </td>
      </tr>
    </table>
    ` : ''}
  `

  return {
    html: baseLayout({ previewText: previewText || 'Tài khoản của bạn đã được kích hoạt', bodyHtml }),
    text: `Chào mừng đến với ${BRAND.name}! Tài khoản đã được xác thực.\n\n${loginUrl ? `Đăng nhập: ${loginUrl}` : ''}`,
    subject: `Chào mừng bạn đến với ${BRAND.name}! 🎉`,
  }
}

// ============================================
// 3. Password changed notification
// ============================================
export function passwordChangedTemplate(props: BaseEmailProps & { changedAt?: Date; supportUrl?: string }): { html: string; text: string; subject: string } {
  const { recipientName, changedAt = new Date(), supportUrl, previewText } = props
  const greeting = recipientName ? `Xin chào <strong>${escapeHtml(recipientName)}</strong>` : 'Xin chào'
  const time = changedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">🔒 Mật khẩu đã được thay đổi</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>
      Chúng tôi xác nhận rằng mật khẩu tài khoản <strong>${BRAND.name}</strong> của bạn vừa được thay đổi vào <strong>${time}</strong>.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="background-color: #f0fdf4; border-left: 3px solid ${BRAND.success}; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: #14532d; line-height: 1.5;">
            <strong>✅ Đổi mật khẩu thành công</strong><br/>
            Nếu đây là bạn, bạn không cần làm gì thêm.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0 0; background-color: #fef2f2; border-left: 3px solid ${BRAND.error}; border-radius: 8px;">
      <tr>
        <td style="padding: 16px; font-size: 14px; color: #7f1d1d; line-height: 1.5;">
          <strong>⚠️ Không phải bạn?</strong><br/>
          Nếu bạn không thực hiện thay đổi này, hãy liên hệ ngay với chúng tôi${supportUrl ? ` qua <a href="${escapeHtml(supportUrl)}" style="color: ${BRAND.primary}; font-weight: 600;">trang hỗ trợ</a>` : ''} để bảo vệ tài khoản.
        </td>
      </tr>
    </table>
  `

  return {
    html: baseLayout({ previewText: previewText || 'Mật khẩu của bạn vừa được thay đổi', bodyHtml }),
    text: `Mật khẩu ${BRAND.name} của bạn vừa được thay đổi lúc ${time}.\n\nNếu không phải bạn, hãy liên hệ hỗ trợ ngay.`,
    subject: `[${BRAND.name}] Mật khẩu vừa được thay đổi`,
  }
}

// ============================================
// 4. Email change verification
// ============================================
export function emailChangeTemplate(props: BaseEmailProps & { newEmail: string; changeUrl: string; expiresInHours?: number }): { html: string; text: string; subject: string } {
  const { recipientName, newEmail, changeUrl, expiresInHours = 24, previewText } = props
  const greeting = recipientName ? `Xin chào <strong>${escapeHtml(recipientName)}</strong>` : 'Xin chào'

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">📧 Xác nhận thay đổi email</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>
      Chúng tôi nhận được yêu cầu thay đổi email tài khoản <strong>${BRAND.name}</strong> sang địa chỉ <strong style="color: ${BRAND.primary};">${escapeHtml(newEmail)}</strong>.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, ${BRAND.bg} 0%, #f3eee9 100%); border-radius: 16px; padding: 28px 24px;">
          <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.textMuted};">
            Nhấn nút bên dưới để xác nhận thay đổi:
          </p>
          <a href="${escapeHtml(changeUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(169, 49, 25, 0.25);">
            Xác nhận thay đổi
          </a>
          <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND.textMuted};">
            ⏱️ Link có hiệu lực trong <strong>${expiresInHours} giờ</strong>
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5; word-break: break-all;">
      Hoặc copy link: <a href="${escapeHtml(changeUrl)}" style="color: ${BRAND.primary};">${escapeHtml(changeUrl)}</a>
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0 0; background-color: #fff8e1; border-left: 3px solid #f59e0b; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; color: #78350f; line-height: 1.5;">
          Nếu bạn không yêu cầu thay đổi, hãy bỏ qua email — email hiện tại sẽ được giữ nguyên.
        </td>
      </tr>
    </table>
  `

  return {
    html: baseLayout({ previewText: previewText || 'Xác nhận thay đổi địa chỉ email', bodyHtml }),
    text: `Yêu cầu thay đổi email sang ${newEmail}.\nXác nhận: ${changeUrl}\nLink có hiệu lực ${expiresInHours} giờ.`,
    subject: `[${BRAND.name}] Xác nhận thay đổi địa chỉ email`,
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
  deposit?: { amount: number; url: string; deadline?: string }
}

export function bookingConfirmationTemplate(props: BookingConfirmationTemplateProps): { html: string; text: string; subject: string } {
  const {
    guestName, bookingCode, propertyName, propertyAddress, propertyPhone,
    checkIn, checkOut, numAdults, numChildren, totalAmount, currency = 'VND', propertyUrl, notes,
    checkInTime = '14:00', checkOutTime = '12:00', awaitingConfirmation = false, deposit,
  } = props

  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  )

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">${awaitingConfirmation ? 'Đã nhận yêu cầu đặt phòng' : '✅ Đặt phòng thành công'}</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      Xin chào <strong style="color: ${BRAND.text};">${escapeHtml(guestName)}</strong>,<br/>
      ${awaitingConfirmation
        ? `Cảm ơn bạn đã đặt phòng. ${escapeHtml(propertyName)} sẽ liên hệ với bạn để xác nhận; phòng chỉ được giữ chắc chắn khi khách sạn xác nhận. Dưới đây là thông tin yêu cầu của bạn:`
        : 'Cảm ơn bạn đã đặt phòng. Dưới đây là thông tin chi tiết:'}
    </p>

    <!-- Booking code banner -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); border-radius: 12px; padding: 16px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 4px;">
            Mã đặt phòng
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
                <div style="font-size: 11px; color: ${BRAND.textMuted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 4px;">Nhận phòng</div>
                <div style="font-size: 15px; color: ${BRAND.text}; font-weight: 600;">${formatDate(checkIn)}</div>
                <div style="font-size: 12px; color: ${BRAND.textMuted};">từ ${escapeHtml(checkInTime)}</div>
              </td>
              <td width="50%" style="padding: 8px 0;">
                <div style="font-size: 11px; color: ${BRAND.textMuted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 4px;">Trả phòng</div>
                <div style="font-size: 15px; color: ${BRAND.text}; font-weight: 600;">${formatDate(checkOut)}</div>
                <div style="font-size: 12px; color: ${BRAND.textMuted};">trước ${escapeHtml(checkOutTime)}</div>
              </td>
            </tr>
          </table>
          <div style="border-top: 1px solid ${BRAND.border}; margin: 8px 0;"></div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: ${BRAND.textMuted};">
                👥 ${numAdults} người lớn${numChildren > 0 ? `, ${numChildren} trẻ em` : ''}
              </td>
              <td align="right" style="padding: 4px 0; font-size: 13px; color: ${BRAND.textMuted};">
                🌙 ${nights} đêm
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
          <strong>📝 Ghi chú:</strong> ${escapeHtml(notes)}
        </td>
      </tr>
    </table>
    ` : ''}

    ${deposit ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid ${BRAND.border}; border-radius: 12px;">
      <tr>
        <td style="padding: 20px; text-align: center;">
          <div style="font-size: 15px; color: ${BRAND.text}; font-weight: 600; margin-bottom: 6px;">Đặt cọc ${formatVnd(deposit.amount, currency)} để khách sạn xác nhận</div>
          <div style="font-size: 13px; color: ${BRAND.textMuted}; margin-bottom: 16px;">
            Chuyển khoản qua PayOS, tiền vào thẳng tài khoản của ${escapeHtml(propertyName)}.${deposit.deadline ? ` Hạn đặt cọc: ${escapeHtml(deposit.deadline)}; quá hạn, đặt phòng tự huỷ.` : ''} Đã đặt cọc rồi thì bỏ qua.
          </div>
          <a href="${escapeHtml(deposit.url)}" style="display: inline-block; background: ${BRAND.text}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 600;">
            Đặt cọc qua PayOS
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
            ${awaitingConfirmation ? 'Tạm tính' : 'Tổng thanh toán'}
          </div>
          <div style="font-size: 28px; color: ${BRAND.primary}; font-weight: 800;">
            ${formatVnd(totalAmount, currency)}
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(propertyUrl)}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(169, 49, 25, 0.25);">
            Xem trang khách sạn →
          </a>
        </td>
      </tr>
    </table>
  `

  return {
    html: baseLayout({ previewText: `Đặt phòng ${bookingCode} tại ${propertyName}`, bodyHtml }),
    text: awaitingConfirmation
      ? `Đã nhận yêu cầu đặt phòng ${bookingCode}\nKhách sạn: ${propertyName} (sẽ liên hệ để xác nhận)\n${formatDate(checkIn)} - ${formatDate(checkOut)}\nTạm tính: ${formatVnd(totalAmount, currency)}${deposit ? `\nĐặt cọc ${formatVnd(deposit.amount, currency)}${deposit.deadline ? ` trước ${deposit.deadline}` : ''}: ${deposit.url}` : ''}\nTrang khách sạn: ${propertyUrl}`
      : `Xác nhận đặt phòng ${bookingCode}\nKhách sạn: ${propertyName}\n${formatDate(checkIn)} - ${formatDate(checkOut)}\nTổng: ${formatVnd(totalAmount, currency)}\nTrang khách sạn: ${propertyUrl}`,
    subject: awaitingConfirmation
      ? `[${bookingCode}] Đã nhận yêu cầu đặt phòng tại ${propertyName}`
      : `[${bookingCode}] ✅ Xác nhận đặt phòng tại ${propertyName}`,
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
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Chủ sở hữu',
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên',
  VIEWER: 'Người xem',
}

export function workspaceInviteTemplate(props: WorkspaceInviteTemplateProps): { html: string; text: string; subject: string } {
  const { recipientName, inviterName, workspaceName, role, inviteUrl, expiresAt, personalMessage, previewText } = props
  const roleLabel = ROLE_LABEL[role] || role
  const greeting = recipientName ? `Xin chào <strong>${escapeHtml(recipientName)}</strong>` : 'Xin chào'
  const expiryStr = expiresAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">💌 Lời mời tham gia</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      ${greeting},<br/>
      <strong style="color: ${BRAND.text};">${escapeHtml(inviterName)}</strong> đã mời bạn tham gia workspace <strong style="color: ${BRAND.primary};">${escapeHtml(workspaceName)}</strong> trên ${BRAND.name}.
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
            Vai trò của bạn
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
            Chấp nhận lời mời →
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: ${BRAND.textMuted};">
            ⏱️ Hết hạn lúc ${expiryStr}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5; word-break: break-all;">
      Hoặc copy link: <a href="${escapeHtml(inviteUrl)}" style="color: ${BRAND.primary};">${escapeHtml(inviteUrl)}</a>
    </p>
  `

  return {
    html: baseLayout({ previewText: previewText || `${inviterName} mời bạn vào ${workspaceName}`, bodyHtml }),
    text: `${inviterName} mời bạn tham gia ${workspaceName} với vai trò ${roleLabel}.\nChấp nhận: ${inviteUrl}\nHết hạn: ${expiryStr}`,
    subject: `${inviterName} mời bạn vào ${workspaceName}`,
  }
}

// ============================================
// 7. Invoice email (improved)
// ============================================
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
}): { html: string; text: string; subject: string } {
  const { customerName, einvoiceNumber, series, lookupCode, bookingCode, propertyName, totalAmount, taxAmount, note, currency = 'VND' } = props
  const row = (label: string, value: string) => `
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">${label}</td>
              <td align="right" style="padding: 6px 0; font-size: 14px; color: ${BRAND.text}; font-weight: 600;">${escapeHtml(value)}</td>
            </tr>`

  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${BRAND.text};">🧾 Hóa đơn điện tử</h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${BRAND.textMuted};">
      Xin chào <strong style="color: ${BRAND.text};">${escapeHtml(customerName)}</strong>,<br/>
      ${escapeHtml(propertyName)} đã phát hành hóa đơn điện tử cho đơn đặt phòng của bạn. Bản PDF được đính kèm email này.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: ${BRAND.surface};">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${row('Số hóa đơn', `${einvoiceNumber} (ký hiệu ${series})`)}
            ${row('Mã tra cứu', lookupCode)}
            ${row('Mã đặt phòng', bookingCode)}
            ${row('Khách sạn', propertyName)}
            ${note ? row('Ghi chú', note) : ''}
            <tr><td colspan="2" style="padding: 8px 0;"><div style="border-top: 1px solid ${BRAND.border};"></div></td></tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">Thuế GTGT</td>
              <td align="right" style="padding: 6px 0; font-size: 14px; color: ${BRAND.text};">${formatVnd(taxAmount, currency)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: ${BRAND.text}; font-weight: 700;">Tổng cộng</td>
              <td align="right" style="padding: 6px 0; font-size: 20px; color: ${BRAND.primary}; font-weight: 800;">${formatVnd(totalAmount, currency)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${BRAND.textMuted};">
      Hóa đơn được phát hành qua Mắt Bão; có thể tra cứu trên cổng hóa đơn của Mắt Bão bằng mã tra cứu ở trên.
    </p>
  `

  return {
    html: baseLayout({ previewText: `Hóa đơn số ${einvoiceNumber} - ${formatVnd(totalAmount, currency)}`, bodyHtml }),
    text: [
      `Xin chào ${customerName},`,
      `${propertyName} đã phát hành hóa đơn điện tử cho đơn đặt phòng của bạn (PDF đính kèm).`,
      `Số hóa đơn: ${einvoiceNumber} (ký hiệu ${series})`,
      `Mã tra cứu: ${lookupCode}`,
      `Mã đặt phòng: ${bookingCode}`,
      ...(note ? [`Ghi chú: ${note}`] : []),
      `Thuế GTGT: ${formatVnd(taxAmount, currency)}`,
      `Tổng cộng: ${formatVnd(totalAmount, currency)}`,
    ].join('\n'),
    subject: `Hóa đơn điện tử số ${einvoiceNumber} - ${propertyName}`,
  }
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
