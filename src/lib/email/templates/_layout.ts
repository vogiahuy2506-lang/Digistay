/**
 * Base HTML wrapper for all transactional emails.
 * Provides consistent Digistay branding and Vietnamese-friendly typography.
 */
export function emailLayout({
  title,
  body,
  preheader,
  siteUrl = 'http://localhost:3000',
}: {
  title: string
  body: string
  preheader?: string
  siteUrl?: string
}): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${title}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</span>` : ''}
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #fbf9f6; color: #1b1c1a; }
    a { color: #a93119; text-decoration: none; }
    .btn { display: inline-block; background: #a93119; color: #ffffff !important; padding: 13px 28px; border-radius: 10px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(169,49,25,0.2); }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e2df; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
    .content { padding: 36px 32px 28px; }
    .footer { background: #fbf9f6; padding: 24px 32px; border-top: 1px solid #e4e2df; text-align: center; font-size: 12px; color: #59413c; }
    h1, h2, h3 { color: #1b1c1a; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
    .label { color: #59413c; font-size: 13px; }
    .value { color: #1b1c1a; font-weight: 600; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .content { padding: 24px 18px !important; }
      .footer { padding: 20px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #fbf9f6;">
  <div style="padding: 24px 12px;">
    <div class="container">
      <div style="background: linear-gradient(135deg, #a93119 0%, #bd3c22 45%, #cb492f 100%); padding: 32px 32px 26px; text-align: center;">
        <div style="display: inline-block; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.25); border-radius: 12px; padding: 10px 18px; margin-bottom: 8px;">
          <a href="${siteUrl}" style="color: #ffffff; font-size: 20px; font-weight: 700; text-decoration: none; letter-spacing: 0.5px;">🏨 Digistay</a>
        </div>
        <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 13px; letter-spacing: 0.2px;">Hotel OS — Hệ điều hành quản lý khách sạn</p>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px;">Email này được gửi tự động từ hệ thống <a href="${siteUrl}" style="color: #a93119; font-weight: 600;">Digistay</a></p>
        <p style="margin: 0;">© ${new Date().getFullYear()} Digistay. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  </div>
</body>
</html>`
}
